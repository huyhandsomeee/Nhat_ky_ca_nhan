export function canComment(user) {
  return Boolean(user && !user.needsProfileSetup);
}
