export const onRequest: PagesFunction = async (context) => {
    // This lets /api/* routes resolve from functions/api/*
    return context.next();
  };
  