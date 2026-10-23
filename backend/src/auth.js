export const bearerToken = (header = '') => /^Bearer\s+(.+)$/i.exec(header)?.[1] || '';

export function createAuthMiddleware(firebaseAuth, allowedUids) {
  return async (request, response, next) => {
    try {
      const token = bearerToken(request.headers.authorization);
      if (!token) return response.status(401).json({ error: 'Token ausente.' });
      const decoded = await firebaseAuth.verifyIdToken(token, true);
      if (!allowedUids.has(decoded.uid)) return response.status(403).json({ error: 'Usuário não autorizado para esta planilha.' });
      request.user = { uid: decoded.uid, email: decoded.email || null }; next();
    } catch { response.status(401).json({ error: 'Token inválido ou revogado.' }); }
  };
}
