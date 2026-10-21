export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(method, url, body) {
  const isForm = body instanceof FormData;
  let res;
  try {
    res = await fetch(`/api${url}`, {
      method,
      credentials: 'include',
      headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    });
  } catch {
    throw new ApiError('Serveur injoignable. Vérifiez votre connexion.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || `Erreur ${res.status}`, res.status);
  return data;
}

export const api = {
  get: (url) => request('GET', url),
  post: (url, body) => request('POST', url, body),
  patch: (url, body) => request('PATCH', url, body),
  del: (url, body) => request('DELETE', url, body),
};

/** Téléversement avec suivi de progression. */
export function upload(url, file, { field = 'file', onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append(field, file);
    xhr.open('POST', `/api${url}`);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* ignore */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new ApiError(data.error || 'Échec du téléversement', xhr.status));
    };
    xhr.onerror = () => reject(new ApiError('Échec du téléversement', 0));
    xhr.send(form);
  });
}

export function saveBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** Télécharge une réponse de l'API en respectant le nom de fichier fourni par le serveur. */
export async function downloadFrom(url, fallbackName) {
  const res = await fetch(`/api${url}`, { credentials: 'include' });
  if (!res.ok) throw new ApiError("Échec de l'export", res.status);
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/);
  saveBlob(await res.blob(), match?.[1] || fallbackName);
}
