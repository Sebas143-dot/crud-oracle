//#region Imports

require('dotenv').config();
const oracledb = require('oracledb');
const express = require('express');
const api = express.Router();
api.use(express.json());
const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET;
const verificar = require('../config/auth');

//#endregion

api.get('/test', (req, res) => {
    res.json({ message: true });
});

api.post('/login', async (req, res) => {
    const { user, password } = req.body;

    try {
        const connection = await oracledb.getConnection({
            user,
            password,
            connectString: process.env.ORACLE_CONNECT_STRING
        });
        await connection.close();

        // Si la conexión es exitosa, se genera un token
        console.log(`El usuario ${user} se conectó a la BDD Exitosamente`);
        const token = jwt.sign({ user, password }, SECRET, { expiresIn: '1h' });
        res.json({
            token
        });
    } catch (err) {
        // Manejo simple por código de error
        if (err.message && err.message.includes('ORA-01017')) {
            res.status(401).json({
                error: 'Usuario o contraseña incorrectos'
            });
        } else {
            console.error('Error al conectar a Oracle:', err);
            res.status(500).json({
                error: 'Error al conectar a Oracle',
                details: err.message
            });
        }
    }
});

api.get('/tablas', verificar, async (req, res) => {
    try {
        const connection = await oracledb.getConnection({
            user: req.user,
            password: req.password,
            connectString: process.env.ORACLE_CONNECT_STRING
        });

        const result = await connection.execute(
            `SELECT 
                t.owner,
                t.table_name,
                LISTAGG(p.privilege, ', ') 
                WITHIN GROUP (ORDER BY p.privilege) AS privileges
            FROM all_tables t
            JOIN all_tab_privs p 
            ON t.table_name = p.table_name
            WHERE p.grantee = USER
            GROUP BY t.owner, t.table_name
            ORDER BY t.owner, t.table_name`
        );

        await connection.close();

        // Si la conexión es exitosa, se genera un token
        console.log(`El usuario ${req.user} solicitó las tablas de la BDD Exitosamente`);

        const tablas = [];

        for (let i = 0; i < result.rows.length; i++) {
            let row = result.rows[i];
            tablas.push({
                owner: row[0],
                table_name: row[1],
                privileges: {
                    select: row[2].includes('SELECT'),
                    insert: row[2].includes('INSERT'),
                    update: row[2].includes('UPDATE'),
                    delete: row[2].includes('DELETE')
                }
            })
        }

        res.json({
            result: tablas
        });
    } catch (err) {
        // Manejo simple por código de error
        console.error('Error al solicitar tablas a Oracle:\n', err);
        res.status(500).json({
            error: 'Error al solicitar tablas a Oracle',
            details: err.message
        });
    }
});

api.get('/tabla', verificar, async (req, res) => {
    const { owner, table_name } = req.query;

    if (!owner || !table_name) {
        return res.status(400).json({
            error: 'Faltan parámetros owner o table_name'
        });
    }

    try {
        const connection = await oracledb.getConnection({
            user: req.user,
            password: req.password,
            connectString: process.env.ORACLE_CONNECT_STRING
        });

        const result = await connection.execute(
            `SELECT * FROM ${owner}.${table_name}`
        );

        await connection.close();

        // Si la conexión es exitosa, se genera un token
        console.log(`El usuario ${req.user} solicitó la tabla '${owner}.${table_name}' de la BDD Exitosamente`);

        res.json({
            columns: result.metaData.map(col => col.name),
            data: result.rows
        });
    } catch (err) {
        // Manejo simple por código de error
        console.error('Error al solicitar tablas a Oracle:\n', err);
        res.status(500).json({
            error: 'Error al solicitar tablas a Oracle',
            details: err.message
        });
    }
});


module.exports = api;