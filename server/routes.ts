import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { TRPCError } from "@trpc/server";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  books: router({
    // Get all books for the current user
    getUserBooks: protectedProcedure.query(async ({ ctx }) => {
      try {
        const books = await db.getUserBooks(ctx.user.id);
        return books;
      } catch (error) {
        console.error("Failed to get user books:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch books",
        });
      }
    }),

    // Get a specific book by ID
    getBook: protectedProcedure
      .input(z.object({ bookId: z.number() }))
      .query(async ({ ctx, input }) => {
        try {
          const book = await db.getBookById(input.bookId);
          if (!book) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Book not found",
            });
          }
          // Verify ownership
          if (book.userId !== ctx.user.id) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "You don't have access to this book",
            });
          }
          return book;
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.error("Failed to get book:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch book",
          });
        }
      }),

    // Get chapters for a book
    getChapters: protectedProcedure
      .input(z.object({ bookId: z.number() }))
      .query(async ({ ctx, input }) => {
        try {
          const book = await db.getBookById(input.bookId);
          if (!book) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Book not found",
            });
          }
          // Verify ownership
          if (book.userId !== ctx.user.id) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "You don't have access to this book",
            });
          }
          const chapters = await db.getBookChapters(input.bookId);
          return chapters;
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.error("Failed to get chapters:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch chapters",
          });
        }
      }),

    // Create a new book
    createBook: protectedProcedure
      .input(z.object({
        title: z.string().min(1),
        genre: z.string().min(1),
        topic: z.string().optional(),
        tone: z.string().optional(),
        targetAudience: z.string().optional(),
        chapterCount: z.number().min(1).max(50),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const result = await db.createBook(ctx.user.id, input);
          // Get the inserted book ID from the result
          const bookId = (result as any).insertId;
          const book = await db.getBookById(bookId);
          return book;
        } catch (error) {
          console.error("Failed to create book:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create book",
          });
        }
      }),

    // Delete a book
    deleteBook: protectedProcedure
      .input(z.object({ bookId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        try {
          const book = await db.getBookById(input.bookId);
          if (!book) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Book not found",
            });
          }
          // Verify ownership
          if (book.userId !== ctx.user.id) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "You don't have access to this book",
            });
          }
          await db.deleteBook(input.bookId);
          return { success: true };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.error("Failed to delete book:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to delete book",
          });
        }
      }),

    // Update book progress
    updateProgress: protectedProcedure
      .input(z.object({
        bookId: z.number(),
        progress: z.number().min(0).max(100),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const book = await db.getBookById(input.bookId);
          if (!book) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Book not found",
            });
          }
          // Verify ownership
          if (book.userId !== ctx.user.id) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "You don't have access to this book",
            });
          }
          await db.updateBook(input.bookId, { generationProgress: input.progress });
          return { success: true };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.error("Failed to update progress:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update progress",
          });
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
