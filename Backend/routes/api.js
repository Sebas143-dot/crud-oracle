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

        // metaData ya trae el nombre y el tipo de dato
        const columns = result.metaData.map(col => ({
            name: col.name,
            type: col.dbTypeName // o col.dbType para el código numérico
        }));

        res.json({
            columns, // ahora es un array de objetos { name, type }
            data: result.rows
        });
    } catch (err) {
        console.error('Error al solicitar tablas a Oracle:\n', err);
        res.status(500).json({
            error: 'Error al solicitar tablas a Oracle',
            details: err.message
        });
    }
});

api.post('/tabla', verificar, async (req, res) => {
    let { owner, table_name, columns, data } = req.body;

    // Asegura que columns sea array
    if (!Array.isArray(columns)) {
        if (typeof columns === 'string') {
            columns = columns.split(',').map(col => col.trim());
        } else {
            return res.status(400).json({ error: 'columns debe ser un array o string separado por comas' });
        }
    }

    // Asegura que data sea array de arrays
    if (!Array.isArray(data[0])) {
        data = [data];
    }

    if (!owner || !table_name || !data || !columns) {
        return res.status(400).json({
            error: 'Faltan parámetros owner, table_name, columns o data'
        });
    }

    try {
        const connection = await oracledb.getConnection({
            user: req.user,
            password: req.password,
            connectString: process.env.ORACLE_CONNECT_STRING
        });

        // Cambia los placeholders a :1, :2, :3, ...
        const sql = `INSERT INTO ${owner}.${table_name} (${columns.join(', ')}) VALUES (${columns.map((_, i) => `:${i + 1}`).join(', ')})`;

        await connection.executeMany(sql, data);

        await connection.commit();
        await connection.close();

        console.log(`El usuario ${req.user} insertó datos en la tabla '${owner}.${table_name}' de la BDD Exitosamente`);

        res.json({
            message: 'Datos insertados correctamente'
        });
    } catch (err) {
        console.error('Error al insertar datos en Oracle:\n', err);
        res.status(500).json({
            error: 'Error al insertar datos en Oracle',
            details: err.message
        });
    }
});

api.put('/tabla', verificar, async (req, res) => {
    let { owner, table_name, columns, data, key_column, key_data } = req.body;

    console.log(req.body);

    if (!owner || !table_name || !data || !columns || !key_column) {
        return res.status(400).json({
            error: 'Faltan parámetros owner, table_name, columns, data o key_column'
        });
    }

    console.log(data);

    // Si data es un solo array (una fila), conviértelo en array de arrays
    if (!Array.isArray(data[0])) {
        data.push(key_data);
        data = [data];
    }

    console.log(data);

    // El SQL debe tener un placeholder para cada columna y uno para la clave
    const setClause = columns.map((col, i) => `${col} = :${i + 1}`).join(', ');
    const whereClause = `${key_column} = :${columns.length + 1}`;
    const sql = `UPDATE ${owner}.${table_name} SET ${setClause} WHERE ${whereClause}`;

    try {
        const connection = await oracledb.getConnection({
            user: req.user,
            password: req.password,
            connectString: process.env.ORACLE_CONNECT_STRING
        });

        await connection.executeMany(sql, data);

        await connection.commit();
        await connection.close();

        res.json({
            message: 'Datos actualizados correctamente'
        });
    } catch (err) {
        console.error('Error al actualizar datos en Oracle:\n', err);
        res.status(500).json({
            error: 'Error al actualizar datos en Oracle',
            details: err.message
        });
    }
});

api.delete('/tabla', verificar, async (req, res) => {
    const { owner, table_name, column, data } = req.body;

    if (!owner || !table_name || !data || !column) {
        return res.status(400).json({
            error: 'Faltan parámetros owner, table_name, columns o data'
        });
    }

    try {
        const connection = await oracledb.getConnection({
            user: req.user,
            password: req.password,
            connectString: process.env.ORACLE_CONNECT_STRING
        });

        let sql = ``;

        sql = `DELETE FROM ${owner}.${table_name} WHERE ${column} IN (${data.map(() => '?').join(', ')})`;

        await connection.executeMany(sql, data);

        await connection.commit();
        await connection.close();

        console.log(`El usuario ${req.user} eliminó datos en la tabla '${owner}.${table_name}' de la BDD Exitosamente`);

        res.json({
            message: 'Datos eliminados correctamente'
        });
    } catch (err) {
        // Manejo simple por código de error
        console.error('Error al eliminar datos en Oracle:\n', err);
        res.status(500).json({
            error: 'Error al eliminar datos en Oracle',
            details: err.message
        });
    }
});

module.exports = api;