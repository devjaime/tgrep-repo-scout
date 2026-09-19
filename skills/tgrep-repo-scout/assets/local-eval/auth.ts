export function validateResetToken(token, now) {
  if (token.expiresAt <= now) throw new Error('expired reset token');
  return token.subject;
}
