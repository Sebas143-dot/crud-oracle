const { Pool } = require('pg');

// Configuración de conexión a PostgreSQL
const getPool = (user, password) => {
    return new Pool({
        user: user,
        password: password,
        host: process.env.POSTGRES_HOST || 'localhost',
        port: process.env.POSTGRES_PORT || 5432,
        database: process.env.POSTGRES_DATABASE || 'postgres',
        // Configuraciones adicionales
        max: 20, // máximo número de clientes en el pool
        idleTimeoutMillis: 30000, // tiempo de espera antes de cerrar conexiones inactivas
        connectionTimeoutMillis: 2000, // tiempo de espera para obtener conexión
    });
};

// Pool principal para consultas administrativas (usando variables de entorno)
const adminPool = new Pool({
    user: process.env.POSTGRES_ADMIN_USER || 'postgres',
    password: process.env.POSTGRES_ADMIN_PASSWORD,
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
    database: process.env.POSTGRES_DATABASE || 'postgres',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

module.exports = {
    getPool,
    adminPool
};
