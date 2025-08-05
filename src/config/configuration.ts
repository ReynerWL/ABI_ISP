export default () => {
  return {
    env: process.env.NODE_ENV,
    port: parseInt(process.env.PORT, 10) || 3000,
    jwt: {
      secret: process.env.JWT_SECRET_KEY,
    },
  };
};
