const { Pool } = require('pg');

// Configuración de conexión a PostgreSQL
const getPool = (user, password) => {
    const isAzure = process.env.POSTGRES_HOST && process.env.POSTGRES_HOST.includes('azure.com');

    const poolConfig = {
        user: user,
        password: password,
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT) || 5432,
        database: process.env.POSTGRES_DATABASE || '05-abd-crud-postgres',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 15000,
        // SSL requerido para Azure
        ssl: isAzure ? {
            rejectUnauthorized: false
        } : false
    };
    
    const pool = new Pool(poolConfig);

    pool.on('error', (err) => {
        console.error('Error en el pool de PostgreSQL:', err.message);
        console.error('Código de error:', err.code);
    });

    return pool;
};

// Pool principal para consultas administrativas (usando variables de entorno)
const adminPool = new Pool({
    user: process.env.POSTGRES_ADMIN_USER || 'postgres',
    password: process.env.POSTGRES_ADMIN_PASSWORD,
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
    database: process.env.POSTGRES_DATABASE || '05-abd-crud-postgres',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

module.exports = {
    getPool,
    adminPool
};