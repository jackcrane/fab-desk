export function needsNameCompletion(user) {
  if (!user) {
    return false;
  }

  const normalizedName = typeof user.name === "string" ? user.name.trim() : "";
  const normalizedEmail = typeof user.email === "string" ? user.email.trim().toLowerCase() : "";
  if (!normalizedName) {
    return true;
  }

  return normalizedEmail.length > 0 && normalizedName.toLowerCase() === normalizedEmail;
}

export function isLikelyEmail(value) {
  return value.includes("@");
}
