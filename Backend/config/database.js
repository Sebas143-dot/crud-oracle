const oracledb = require('oracledb');
require('dotenv').config();

const connection = null;

async function testConnection(user, password) {
    let connection;
    try {
        connection = await oracledb.getConnection({
            user,
            password,
            connectString: process.env.ORACLE_CONNECT_STRING
        });
        console.log('¡Conexión exitosa a Oracle!');
    } catch (err) {
        console.error('Error al conectar:', err);
    } finally {
        if (connection) await connection.close();
    }
}