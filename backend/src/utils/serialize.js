export function publicUser(row, prefix = '') {
  if (!row || row[`${prefix}id`] == null) return null;
  return {
    id: row[`${prefix}id`],
    username: row[`${prefix}username`],
    displayName: row[`${prefix}display_name`],
    avatarUrl: row[`${prefix}avatar_url`] || null,
    accentColor: row[`${prefix}accent_color`] || '#6366f1',
    bio: row[`${prefix}bio`] ?? undefined,
    customStatus: row[`${prefix}custom_status`] ?? undefined,
  };
}

export function selfUser(row) {
  return {
    ...publicUser(row),
    email: row.email,
    preferredStatus: row.preferred_status,
    createdAt: row.created_at,
  };
}

export function roomDto(row) {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    description: row.description,
    icon: row.icon,
    color: row.color,
    category: row.category,
    isPrivate: !!row.is_private,
    ownerId: row.owner_id,
    createdAt: row.created_at,
  };
}
