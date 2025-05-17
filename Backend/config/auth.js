const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET;

const verificar = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader;
    if (!token) return res.status(401).json({ error: 'Token requerido' });

    jwt.verify(token, SECRET, (err, payload) => {
        if (err) return res.status(403).json({ error: 'Token inválido' });
        req.user = payload.user; // Puedes guardar más datos si los pusiste en el payload
        req.password = payload.password; // Puedes guardar más datos si los pusiste en el payload
        next();
    });
}

module.exports = verificar;