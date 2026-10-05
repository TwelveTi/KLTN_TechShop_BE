require("dotenv").config();
const http = require("http");
const app = require("./src/app");
const connectDB = require("./src/utils/connectDB");
const logger = require("./src/utils/logger");
const kafkaManager = require("./src/kafkas");

const server = http.createServer(app);

// Mặc định 0.0.0.0 chứ không phải localhost: trong container, bind localhost thì
// tiến trình vẫn chạy và vẫn ghi log "Server is running", nhưng không request nào
// từ ngoài container tới được.
connectDB().then(async () => {
  const port = process.env.PORT || 3000;
  const hostname = process.env.HOST_NAME || "0.0.0.0";

  server.listen(port, hostname, () => {
    console.log(`Server is running at http://${hostname}:${port}`);
  });

  // Kafka is best-effort: if the broker is down, the API still serves requests
  try {
    await kafkaManager.init();
  } catch (error) {
    logger.error("Kafka initialization failed; continuing without Kafka", {
      error: logger.serializeError(error),
    });
  }
}).catch((error) => {
  // Thoát với mã lỗi để nền tảng triển khai khởi động lại, thay vì để tiến trình
  // sống mà không hề lắng nghe cổng nào.
  logger.error("Database connection failed on startup", {
    error: logger.serializeError(error),
  });
  process.exit(1);
});

async function shutdown(signal) {
  logger.warn("Shutting down server", { signal });

  await kafkaManager.shutdown();

  server.close(() => process.exit(0));

  // Force exit if graceful shutdown hangs.
  setTimeout(() => process.exit(1), 10000).unref();
}

["SIGINT", "SIGTERM"].forEach((signal) => {
  process.on(signal, () => shutdown(signal));
});
