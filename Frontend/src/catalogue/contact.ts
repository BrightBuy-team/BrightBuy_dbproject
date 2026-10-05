// Public build-time contact detail, not a secret. Reject URL/header syntax.
export function contactEmail(value: string | undefined): string | undefined {
  const email = value?.trim()
  return email && /^[A-Za-z0-9._+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(email)
    ? email : undefined
}
