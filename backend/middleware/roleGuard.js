function requireRole(allowedRoles = []) {
  const set = new Set(allowedRoles);
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role || !set.has(role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return next();
  };
}

module.exports = { requireRole };

