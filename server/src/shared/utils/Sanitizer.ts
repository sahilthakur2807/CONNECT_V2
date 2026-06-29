export function sanitizeUserForClient(user: any, requesterRole?: string) {
  if (!user) return user;

  const targetRole = user.role;
  let shouldSanitize = false;

  if (targetRole === 'superadmin') {
    if (requesterRole !== 'superadmin') {
      shouldSanitize = true;
    }
  } else if (targetRole === 'admin') {
    if (requesterRole !== 'superadmin' && requesterRole !== 'admin') {
      shouldSanitize = true;
    }
  }

  if (shouldSanitize) {
    const sanitized = { ...user };
    sanitized.role = 'user';
    if (sanitized.badges) {
      sanitized.badges = sanitized.badges.filter((b: string) => {
        const lower = b.toLowerCase();
        return !lower.includes('admin') && !lower.includes('super');
      });
    }
    return sanitized;
  }

  return user;
}

export function sanitizePayload(data: any, requesterRole?: string): any {
  if (data === null || data === undefined) return data;

  if (Array.isArray(data)) {
    return data.map(item => sanitizePayload(item, requesterRole));
  }

  if (typeof data === 'object') {
    if ('role' in data && ('username' in data || 'email' in data || 'avatar' in data)) {
      const sanitizedUser = sanitizeUserForClient(data, requesterRole);
      const result: any = {};
      for (const key of Object.keys(sanitizedUser)) {
        result[key] = sanitizePayload(sanitizedUser[key], requesterRole);
      }
      return result;
    }

    const result: any = {};
    for (const key of Object.keys(data)) {
      result[key] = sanitizePayload(data[key], requesterRole);
    }
    return result;
  }

  return data;
}
