export default () => {
  return {
    env: process.env.NODE_ENV,
    port: parseInt(process.env.PORT, 10) || 3000,
    jwt: {
      public: process.env.JWT_PUBLIC_KEY,
    },
  };
};
