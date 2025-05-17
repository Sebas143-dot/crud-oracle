require('dotenv').config();
const oracledb = require('oracledb');
const express = require('express');
const api = express.Router();
api.use(express.json());

api.get('/test', (req, res) => {
    res.json({ message: 'API FUNCANDO!' });
});

api.post('/test-oracle', async (req, res) => {
    const { user, password } = req.body;

    try {
        const connection = await oracledb.getConnection({
            user,
            password,
            connectString: process.env.ORACLE_CONNECT_STRING
        });
        console.log('Conexión exitosa a Oracle');
        res.json({ message: 'Conexión exitosa a Oracle' });
        await connection.close();
    } catch (err) {
        // Manejo simple por código de error
        if (err.message && err.message.includes('ORA-01017')) {
            res.status(401).json({
                error: 'Usuario o contraseña incorrectos'
            });
        } else {
            res.status(500).json({
                error: 'Error al conectar a Oracle',
                details: err.message
            });
        }
    }
});

module.exports = api;