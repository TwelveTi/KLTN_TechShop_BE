function serializeError(error) {
  if (!error) {
    return null;
  }

  return {
    name: error.name,
    message: error.message,
    stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
  };
}

function log(level, message, meta = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };

  const output = JSON.stringify(entry);

  if (level === "error") {
    console.error(output);
    return;
  }

  if (level === "warn") {
    console.warn(output);
    return;
  }

  console.log(output);
}

module.exports = {
  error: (message, meta) => log("error", message, meta),
  info: (message, meta) => log("info", message, meta),
  serializeError,
  warn: (message, meta) => log("warn", message, meta),
};
