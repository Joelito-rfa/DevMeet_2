export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const badRequest = (msg = 'Requête invalide') => new HttpError(400, msg);
export const unauthorized = (msg = 'Non authentifié') => new HttpError(401, msg);
export const forbidden = (msg = 'Accès refusé') => new HttpError(403, msg);
export const notFound = (msg = 'Introuvable') => new HttpError(404, msg);

export function parse(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw badRequest(issue?.message || 'Données invalides');
  }
  return result.data;
}

export function errorHandler(err, req, res, _next) {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Fichier trop volumineux (15 Mo max)' });
  }
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Erreur interne du serveur' : err.message });
}
