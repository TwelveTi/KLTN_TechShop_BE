const REFRESH_TOKEN_COOKIE_NAME = "refreshToken";
const REFRESH_TOKEN_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const isProduction = process.env.NODE_ENV === "production";

const refreshTokenCookieOptions = {
  httpOnly: true,
  secure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : isProduction,
  sameSite: process.env.COOKIE_SAME_SITE || (isProduction ? "none" : "lax"),
  maxAge: REFRESH_TOKEN_COOKIE_MAX_AGE,
  path: "/",
};

function setRefreshTokenCookie(res, refreshToken) {
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, refreshTokenCookieOptions);
}

function clearRefreshTokenCookie(res) {
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
    ...refreshTokenCookieOptions,
    maxAge: undefined,
  });
}

function readCookie(req, cookieName) {
  const cookieHeader = req.headers.cookie;

  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";").reduce((acc, cookie) => {
    const separatorIndex = cookie.indexOf("=");

    if (separatorIndex === -1) {
      return acc;
    }

    const name = cookie.slice(0, separatorIndex).trim();
    const value = cookie.slice(separatorIndex + 1).trim();
    acc[name] = decodeURIComponent(value);
    return acc;
  }, {});

  return cookies[cookieName] || null;
}

function getRefreshTokenFromCookie(req) {
  return readCookie(req, REFRESH_TOKEN_COOKIE_NAME);
}

module.exports = {
  clearRefreshTokenCookie,
  getRefreshTokenFromCookie,
  setRefreshTokenCookie,
};
