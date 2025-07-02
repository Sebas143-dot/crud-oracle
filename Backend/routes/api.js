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

api.get('/privilegios', verificar, async (req, res) => {
    try {
        const connection = await oracledb.getConnection({
            user: req.user,
            password: req.password,
            connectString: process.env.ORACLE_CONNECT_STRING
        });

        const result = await connection.execute(
            `SELECT privilege FROM user_sys_privs`
        );

        await connection.close();

        // Si la conexión es exitosa, se genera un token
        console.log(`El usuario ${req.user} solicitó los privilegios de la BDD Exitosamente`);

        res.json({
            result: result.rows.map(row => row[0])
        });
    } catch (err) {
        // Manejo simple por código de error
        console.error('Error al solicitar privilegios a Oracle:\n', err);
        res.status(500).json({
            error: 'Error al solicitar privilegios a Oracle',
            details: err.message
        });
    }
});

api.get('/rol', verificar, async (req, res) => {
    try {
        const connection = await oracledb.getConnection({
            user: req.user,
            password: req.password,
            connectString: process.env.ORACLE_CONNECT_STRING
        });

        const result = await connection.execute(
            `SELECT granted_role FROM user_role_privs`
        );

        await connection.close();

        // Si la conexión es exitosa, se genera un token
        console.log(`El usuario ${req.user} solicitó los roles de la BDD Exitosamente`);

        res.json(result.rows.map(row => row[0]));
    } catch (err) {
        // Manejo simple por código de error
        console.error('Error al solicitar roles a Oracle:\n', err);
        res.status(500).json({
            error: 'Error al solicitar roles a Oracle',
            details: err.message
        });
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
            `SELECT owner, table_name, privileges FROM (
                -- Tablas donde el usuario es owner (privilegios implícitos)
                SELECT 
                    owner,
                    table_name,
                    'DELETE, INSERT, SELECT, UPDATE' AS privileges
                FROM all_tables 
                WHERE owner = USER
                
                UNION
                
                -- Tablas con privilegios explícitos otorgados
                SELECT 
                    t.owner,
                    t.table_name,
                    LISTAGG(p.privilege, ', ') 
                    WITHIN GROUP (ORDER BY p.privilege) AS privileges
                FROM all_tables t
                JOIN all_tab_privs p 
                ON t.table_name = p.table_name
                WHERE p.grantee = USER
                GROUP BY t.owner, t.table_name
            )
            ORDER BY owner, table_name`
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

api.get('/types', verificar, async (req, res) => {
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

        // Consulta los nombres y tipos de columnas de la tabla
        const result = await connection.execute(
            `SELECT COLUMN_NAME, DATA_TYPE, DATA_LENGTH, DATA_PRECISION, DATA_SCALE
             FROM ALL_TAB_COLUMNS
             WHERE OWNER = :owner AND TABLE_NAME = :table_name
             ORDER BY COLUMN_ID`,
            { owner: owner.toUpperCase(), table_name: table_name.toUpperCase() }
        );

        await connection.close();

        // Formatea la respuesta
        const columns = result.rows.map(row => ({
            name: row[0],
            type: row[1],
            length: row[2],
            precision: row[3],
            scale: row[4]
        }));

        res.json({ columns });
    } catch (err) {
        console.error('Error al solicitar tipos de columnas a Oracle:\n', err);
        res.status(500).json({
            error: 'Error al solicitar tipos de columnas a Oracle',
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
    let { owner, table_name, key_column, key_data } = req.body;

    if (!owner || !table_name || !key_data || !key_column) {
        return res.status(400).json({
            error: 'Faltan parámetros owner, table_name, key_column o key_data'
        });
    }

    // Si key_data es un solo valor, conviértelo en array
    if (!Array.isArray(key_data)) {
        key_data = [key_data];
    }

    // Convierte a array de arrays para executeMany
    const binds = key_data.map(val => [val]);

    try {
        const connection = await oracledb.getConnection({
            user: req.user,
            password: req.password,
            connectString: process.env.ORACLE_CONNECT_STRING
        });

        const sql = `DELETE FROM ${owner}.${table_name} WHERE ${key_column} = :1`;

        await connection.executeMany(sql, binds);

        await connection.commit();
        await connection.close();

        console.log(`El usuario ${req.user} eliminó datos en la tabla '${owner}.${table_name}' de la BDD Exitosamente`);

        res.json({
            message: 'Datos eliminados correctamente'
        });
    } catch (err) {
        console.error('Error al eliminar datos en Oracle:\n', err);
        res.status(500).json({
            error: 'Error al eliminar datos en Oracle',
            details: err.message
        });
    }
});

api.post('/script/ejecutar-personalizado', verificar, async (req, res) => {
    try {
        const connection = await oracledb.getConnection({
            user: req.user,
            password: req.password,
            connectString: process.env.ORACLE_CONNECT_STRING
        });

        const query = req.body.query.trim();

        // Detectar si es PL/SQL (contiene DECLARE, BEGIN, o bloques)
        const isPLSQL = /^(DECLARE|BEGIN)\s/i.test(query) ||
            /BEGIN\s[\s\S]*END\s*;?\s*$/i.test(query);

        if (isPLSQL) {
            // Configurar SERVEROUTPUT para PL/SQL
            await connection.execute(`BEGIN DBMS_OUTPUT.ENABLE(1000000); END;`);

            // Ejecutar el script PL/SQL
            await connection.execute(query);

            // Recuperar el output de DBMS_OUTPUT
            const result = await connection.execute(`
                DECLARE
                    lines DBMS_OUTPUT.CHARARR;
                    num_lines INTEGER := 1000;
                BEGIN
                    DBMS_OUTPUT.GET_LINES(lines, num_lines);
                    FOR i IN 1..num_lines LOOP
                        IF lines(i) IS NOT NULL THEN
                            :output := :output || lines(i) || CHR(10);
                        END IF;
                    END LOOP;
                END;
            `, { output: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 32000 } });

            await connection.close();

            console.log(`El usuario ${req.user} ejecutó el siguiente script PL/SQL\n${query}\n`); res.json({
                message: 'Script PL/SQL ejecutado correctamente',
                output: result.outBinds.output || 'No hay output'
            });
        } else {
            // Ejecutar como consulta SQL normal
            const result = await connection.execute(query);

            await connection.close();

            console.log(`El usuario ${req.user} ejecutó la siguiente consulta SQL\n${query}\n`);

            res.json({
                message: 'Consulta SQL ejecutada correctamente',
                result: result.rows || [],
                columns: result.metaData ? result.metaData.map(col => col.name) : []
            });
        }
    } catch (err) {
        console.error('Error al ejecutar la query:\n', err);
        res.status(500).json({
            error: 'Error al ejecutar la query',
            details: err.message
        });
    }
})

api.get('/script/tiempo', verificar, async (req, res) => {
    try {
        const connection = await oracledb.getConnection({
            user: req.user,
            password: req.password,
            connectString: process.env.ORACLE_CONNECT_STRING
        });        // Configurar SERVEROUTPUT
        await connection.execute(`BEGIN DBMS_OUTPUT.ENABLE(1000000); END;`);

        // Ejecutar el script principal
        await connection.execute(`
            DECLARE
                -- Variables principales para fechas
                v_fecha DATE := TO_DATE('2025-06-11', 'YYYY-MM-DD');
                v_proximo_dia DATE;
                v_dia_anterior DATE;
                v_anio NUMBER(4);
                v_anio_anterior NUMBER(4);
                v_anio_siguiente NUMBER(4);
                v_bisiesto VARCHAR2(3) := 'No';

                -- Variables para tipos de datos
                v_char         CHAR(10) := 'TextoA';
                v_varchar2     VARCHAR2(20) := 'Texto B';
                v_number       NUMBER(10,2) := 12345.67;
                v_integer      BINARY_INTEGER := -100;
                v_date         DATE := TO_DATE('2025-06-11 10:30:00', 'YYYY-MM-DD HH24:MI:SS');
                v_timestamp    TIMESTAMP := SYSTIMESTAMP;
                v_tz           TIMESTAMP WITH TIME ZONE := FROM_TZ(TIMESTAMP '2025-06-11 10:30:00', 'UTC');
                v_ltz          TIMESTAMP WITH LOCAL TIME ZONE := SYSTIMESTAMP;
                v_interval_ym  INTERVAL YEAR(2) TO MONTH := INTERVAL '02-06' YEAR TO MONTH;
                v_interval_ds  INTERVAL DAY(2) TO SECOND(6) := INTERVAL '05 12:30:45.123456' DAY TO SECOND;
            BEGIN
                -- SECCIÓN 1: OPERACIONES CON FECHAS
                DBMS_OUTPUT.PUT_LINE('============================================================================');
                DBMS_OUTPUT.PUT_LINE('                           OPERACIONES CON FECHAS');
                DBMS_OUTPUT.PUT_LINE('============================================================================');
                
                -- Cálculo de próximos y anteriores días
                v_proximo_dia   := v_fecha + 1;
                v_dia_anterior  := v_fecha - 1;

                -- Extracción del año y cálculo de año anterior y siguiente
                v_anio          := EXTRACT(YEAR FROM v_fecha);
                v_anio_anterior := v_anio - 1;
                v_anio_siguiente := v_anio + 1;

                -- Comprobación de año bisiesto
                IF MOD(v_anio, 4) = 0 AND (MOD(v_anio, 100) != 0 OR MOD(v_anio, 400) = 0) THEN
                    v_bisiesto := 'Sí';
                END IF;

                -- Mostrar resultados de fechas
                DBMS_OUTPUT.PUT_LINE('Fecha original:         ' || TO_CHAR(v_fecha, 'YYYY-MM-DD'));
                DBMS_OUTPUT.PUT_LINE('Día anterior:           ' || TO_CHAR(v_dia_anterior, 'YYYY-MM-DD'));
                DBMS_OUTPUT.PUT_LINE('Próximo día:            ' || TO_CHAR(v_proximo_dia, 'YYYY-MM-DD'));
                DBMS_OUTPUT.PUT_LINE('Año actual:             ' || v_anio);
                DBMS_OUTPUT.PUT_LINE('Año anterior:           ' || v_anio_anterior);
                DBMS_OUTPUT.PUT_LINE('Año siguiente:          ' || v_anio_siguiente);
                DBMS_OUTPUT.PUT_LINE('¿Es bisiesto?:          ' || v_bisiesto);

                -- Otras operaciones comunes con fechas
                DBMS_OUTPUT.PUT_LINE('Fecha más 1 semana:     ' || TO_CHAR(v_fecha + 7, 'YYYY-MM-DD'));
                DBMS_OUTPUT.PUT_LINE('Fecha más 1 mes:        ' || TO_CHAR(ADD_MONTHS(v_fecha, 1), 'YYYY-MM-DD'));
                DBMS_OUTPUT.PUT_LINE('Fecha más 1 año:        ' || TO_CHAR(ADD_MONTHS(v_fecha, 12), 'YYYY-MM-DD'));
                DBMS_OUTPUT.PUT_LINE('Último día del mes:     ' || TO_CHAR(LAST_DAY(v_fecha), 'YYYY-MM-DD'));

                -- SECCIÓN 2: TIPOS DE DATOS
                DBMS_OUTPUT.PUT_LINE('');
                DBMS_OUTPUT.PUT_LINE('================================================================================');
                DBMS_OUTPUT.PUT_LINE('                            TIPOS DE DATOS ORACLE');
                DBMS_OUTPUT.PUT_LINE('================================================================================');

                -- Cabecera de la tabla
                DBMS_OUTPUT.PUT_LINE(RPAD('TIPO DE DATO', 30) || RPAD('VALOR', 50));
                DBMS_OUTPUT.PUT_LINE(RPAD('-', 80, '-'));

                -- Datos formateados como tabla
                DBMS_OUTPUT.PUT_LINE(RPAD('CHAR', 30) || RPAD(v_char, 50));
                DBMS_OUTPUT.PUT_LINE(RPAD('VARCHAR2', 30) || RPAD(v_varchar2, 50));
                DBMS_OUTPUT.PUT_LINE(RPAD('NUMBER', 30) || RPAD(TO_CHAR(v_number), 50));
                DBMS_OUTPUT.PUT_LINE(RPAD('BINARY_INTEGER', 30) || RPAD(TO_CHAR(v_integer), 50));
                DBMS_OUTPUT.PUT_LINE(RPAD('DATE', 30) || RPAD(TO_CHAR(v_date, 'YYYY-MM-DD HH24:MI:SS'), 50));
                DBMS_OUTPUT.PUT_LINE(RPAD('TIMESTAMP', 30) || RPAD(TO_CHAR(v_timestamp, 'YYYY-MM-DD HH24:MI:SS.FF'), 50));
                DBMS_OUTPUT.PUT_LINE(RPAD('TIMESTAMP WITH TIME ZONE', 30) || RPAD(TO_CHAR(v_tz, 'YYYY-MM-DD HH24:MI:SS.FF TZR'), 50));
                DBMS_OUTPUT.PUT_LINE(RPAD('TIMESTAMP WITH LOCAL TIME ZONE', 30) || RPAD(TO_CHAR(v_ltz, 'YYYY-MM-DD HH24:MI:SS.FF'), 50));
                DBMS_OUTPUT.PUT_LINE(RPAD('INTERVAL YEAR TO MONTH', 30) || RPAD(TO_CHAR(v_interval_ym), 50));
                DBMS_OUTPUT.PUT_LINE(RPAD('INTERVAL DAY TO SECOND', 30) || RPAD(TO_CHAR(v_interval_ds), 50));

                -- Línea final
                DBMS_OUTPUT.PUT_LINE(RPAD('-', 80, '-'));
                DBMS_OUTPUT.PUT_LINE('');
                DBMS_OUTPUT.PUT_LINE('================================================================================');
                DBMS_OUTPUT.PUT_LINE('                              FIN DEL PROGRAMA');
                DBMS_OUTPUT.PUT_LINE('================================================================================');
            END;
        `);

        // Recuperar el output de DBMS_OUTPUT
        const result = await connection.execute(`
            DECLARE
                lines DBMS_OUTPUT.CHARARR;
                num_lines INTEGER := 1000;
            BEGIN
                DBMS_OUTPUT.GET_LINES(lines, num_lines);
                FOR i IN 1..num_lines LOOP
                    IF lines(i) IS NOT NULL THEN
                        :output := :output || lines(i) || CHR(10);
                    END IF;
                END LOOP;
            END;
        `, { output: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 32000 } }); await connection.close();

        console.log(`El usuario ${req.user} ejecutó el script combinado de tiempo y tipos de datos`); res.json({
            message: 'Script ejecutado correctamente',
            output: result.outBinds.output || 'No hay output'
        });
    } catch (err) {
        console.error('Error al ejecutar el script combinado:\n', err);
        res.status(500).json({
            error: 'Error al ejecutar el script combinado',
            details: err.message
        });
    }
});

api.get('/script/total-empleados-hr', verificar, async (req, res) => {
    try {
        const connection = await oracledb.getConnection({
            user: req.user,
            password: req.password,
            connectString: process.env.ORACLE_CONNECT_STRING
        });        // Configurar SERVEROUTPUT
        await connection.execute(`BEGIN DBMS_OUTPUT.ENABLE(1000000); END;`);

        // Ejecutar el script principal
        await connection.execute(`
            DECLARE
                v_total_empleados NUMBER;
            BEGIN
                -- Obtener el total de empleados
                SELECT COUNT(*) INTO v_total_empleados
                FROM HR.EMPLOYEES;

                -- Mostrar el resultado
                DBMS_OUTPUT.PUT_LINE('Total de empleados: ' || v_total_empleados);
            END;
        `);

        // Recuperar el output de DBMS_OUTPUT
        const result = await connection.execute(`
            DECLARE
                lines DBMS_OUTPUT.CHARARR;
                num_lines INTEGER := 1000;
            BEGIN
                DBMS_OUTPUT.GET_LINES(lines, num_lines);
                FOR i IN 1..num_lines LOOP
                    IF lines(i) IS NOT NULL THEN
                        :output := :output || lines(i) || CHR(10);
                    END IF;
                END LOOP;
            END;
        `, { output: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 32000 } });

        await connection.close();

        console.log(`El usuario ${req.user} ejecutó el script de total de empleados HR`); res.json({
            message: 'Script de total empleados ejecutado correctamente',
            output: result.outBinds.output || 'No hay output'
        });
    } catch (err) {
        console.error('Error al ejecutar el script de total empleados:\n', err);
        res.status(500).json({
            error: 'Error al ejecutar el script de total empleados',
            details: err.message
        });
    }
});

api.get('/script/fecha-creacion-base', verificar, async (req, res) => {
    try {
        const connection = await oracledb.getConnection({
            user: req.user,
            password: req.password,
            connectString: process.env.ORACLE_CONNECT_STRING
        });        // Configurar SERVEROUTPUT
        await connection.execute(`BEGIN DBMS_OUTPUT.ENABLE(1000000); END;`);

        // Ejecutar el script principal
        await connection.execute(`
            DECLARE
                v_nombre_bd   VARCHAR2(50);
                v_fecha_crea  DATE;
            BEGIN
                -- Obtener nombre y fecha de creación de la BD
                SELECT NAME, CREATED INTO v_nombre_bd, v_fecha_crea
                FROM V$DATABASE;

                -- Mostrar los valores
                DBMS_OUTPUT.PUT_LINE('Nombre de la base de datos: ' || v_nombre_bd);
                DBMS_OUTPUT.PUT_LINE('Fecha de creación:          ' || TO_CHAR(v_fecha_crea, 'YYYY-MM-DD HH24:MI:SS'));
            END;
        `);

        // Recuperar el output de DBMS_OUTPUT
        const result = await connection.execute(`
            DECLARE
                lines DBMS_OUTPUT.CHARARR;
                num_lines INTEGER := 1000;
            BEGIN
                DBMS_OUTPUT.GET_LINES(lines, num_lines);
                FOR i IN 1..num_lines LOOP
                    IF lines(i) IS NOT NULL THEN
                        :output := :output || lines(i) || CHR(10);
                    END IF;
                END LOOP;
            END;
        `, { output: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 32000 } });

        await connection.close();

        console.log(`El usuario ${req.user} ejecutó el script de fecha de creación de la base de datos`); res.json({
            message: 'Script de fecha de creación ejecutado correctamente',
            output: result.outBinds.output || 'No hay output'
        });
    } catch (err) {
        console.error('Error al ejecutar el script de fecha de creación:\n', err);
        res.status(500).json({
            error: 'Error al ejecutar el script de fecha de creación',
            details: err.message
        });
    }
});

api.post('/script/validar-cedula', verificar, async (req, res) => {
    try {
        const { cedula } = req.body;

        if (!cedula) {
            return res.status(400).json({
                error: 'El parámetro cedula es requerido'
            });
        }

        const connection = await oracledb.getConnection({
            user: req.user,
            password: req.password,
            connectString: process.env.ORACLE_CONNECT_STRING
        });

        // Configurar SERVEROUTPUT
        await connection.execute(`BEGIN DBMS_OUTPUT.ENABLE(1000000); END;`);

        // Crear tabla si no existe
        try {
            await connection.execute(`
                create table hr.t_cedula (
                    id_cedula number generated by default on null as identity primary key,
                    nro_cedula varchar2(10) not null unique
                );
            `);
        } catch (err) {
            // Tabla ya existe, continuar
        }        // Ejecutar el script de validación de cédula
        await connection.execute(`
            DECLARE
                v_cedula VARCHAR2(10) := '${cedula}';
                v_suma NUMBER := 0;
                v_digito NUMBER;
                v_verificador NUMBER;
                v_resultado NUMBER;
                v_coeficiente NUMBER;
                
                -- Cursor para obtener cada dígito de la cédula con su posición
                CURSOR c_digitos IS
                    SELECT SUBSTR(v_cedula, LEVEL, 1) AS digito, LEVEL AS posicion
                    FROM DUAL
                    CONNECT BY LEVEL <= 9;
                    
            BEGIN
                -- Verificar que la cédula tenga 10 dígitos
                IF LENGTH(v_cedula) != 10 OR NOT REGEXP_LIKE(v_cedula, '^[0-9]+$') THEN
                    RAISE_APPLICATION_ERROR(-20001, 'La cédula debe tener exactamente 10 dígitos numéricos');
                END IF;

                -- Verificar que los dos primeros dígitos sean válidos (01-24)
                IF TO_NUMBER(SUBSTR(v_cedula, 1, 2)) < 1 OR TO_NUMBER(SUBSTR(v_cedula, 1, 2)) > 24 THEN
                    RAISE_APPLICATION_ERROR(-20001, 'Los dos primeros dígitos deben estar entre 01 y 24');
                END IF;

                -- Verificar que el tercer dígito sea menor a 6
                IF TO_NUMBER(SUBSTR(v_cedula, 3, 1)) >= 6 THEN
                    RAISE_APPLICATION_ERROR(-20001, 'El tercer dígito debe ser menor a 6');
                END IF;

                -- Algoritmo de validación de cédula ecuatoriana usando cursor
                FOR digito_rec IN c_digitos LOOP
                    v_digito := TO_NUMBER(digito_rec.digito);

                    -- Obtener coeficiente según posición
                    IF MOD(digito_rec.posicion, 2) = 1 THEN
                        v_coeficiente := 2;
                    ELSE
                        v_coeficiente := 1;
                    END IF;

                    v_resultado := v_digito * v_coeficiente;

                    IF v_resultado >= 10 THEN
                        v_resultado := v_resultado - 9;
                    END IF;

                    v_suma := v_suma + v_resultado;
                    
                    -- Mostrar el proceso de validación para cada dígito
                    DBMS_OUTPUT.PUT_LINE('Posición ' || digito_rec.posicion || ': dígito=' || digito_rec.digito || 
                                       ', coef=' || v_coeficiente || ', resultado=' || v_resultado);
                END LOOP;

                -- Calcular dígito verificador
                v_verificador := 10 - MOD(v_suma, 10);
                IF v_verificador = 10 THEN
                    v_verificador := 0;
                END IF;
                
                DBMS_OUTPUT.PUT_LINE('Suma total: ' || v_suma);
                DBMS_OUTPUT.PUT_LINE('Dígito verificador calculado: ' || v_verificador);
                DBMS_OUTPUT.PUT_LINE('Último dígito de la cédula: ' || SUBSTR(v_cedula, 10, 1));

                -- Verificar si el último dígito coincide
                IF v_verificador != TO_NUMBER(SUBSTR(v_cedula, 10, 1)) THEN
                    RAISE_APPLICATION_ERROR(-20001, 'La cédula no es válida según el algoritmo de verificación');
                END IF;

                -- Si llegamos aquí, la cédula es válida, insertarla
                INSERT INTO hr.t_cedula (NRO_CEDULA) VALUES (v_cedula);
                COMMIT;

                DBMS_OUTPUT.PUT_LINE('✓ Cédula ' || v_cedula || ' validada e insertada correctamente');

            EXCEPTION
                WHEN DUP_VAL_ON_INDEX THEN
                    RAISE_APPLICATION_ERROR(-20002, 'La cédula ' || v_cedula || ' ya está registrada en el sistema');
                WHEN OTHERS THEN
                    RAISE_APPLICATION_ERROR(-20003, 'Error inesperado: ' || SQLERRM);
            END;
        `);

        // Recuperar el output de DBMS_OUTPUT
        const result = await connection.execute(`
            DECLARE
                lines DBMS_OUTPUT.CHARARR;
                num_lines INTEGER := 1000;
            BEGIN
                DBMS_OUTPUT.GET_LINES(lines, num_lines);
                FOR i IN 1..num_lines LOOP
                    IF lines(i) IS NOT NULL THEN
                        :output := :output || lines(i) || CHR(10);
                    END IF;
                END LOOP;
            END;
        `, { output: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 32000 } });

        await connection.close();

        console.log(`El usuario ${req.user} validó la cédula ${cedula}`);

        res.json({
            message: 'success',
            output: result.outBinds.output || 'Cédula validada correctamente'
        });

    } catch (err) {
        console.error('Error al validar cédula:\n', err);

        // Extraer el mensaje de error personalizado de Oracle
        let errorMessage = err.message;
        if (err.message.includes('ORA-20001:')) {
            errorMessage = err.message.split('ORA-20001: ')[1].split('\n')[0];
        } else if (err.message.includes('ORA-20002:')) {
            errorMessage = err.message.split('ORA-20002: ')[1].split('\n')[0];
        } else if (err.message.includes('ORA-20003:')) {
            errorMessage = err.message.split('ORA-20003: ')[1].split('\n')[0];
        }

        res.status(400).json({
            error: 'Error al validar cédula',
            details: errorMessage
        });
    }
});

module.exports = api;