//#region Imports

require('dotenv').config();
const { Pool } = require('pg');
const express = require('express');
const api = express.Router();
api.use(express.json());
const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET;
const verificar = require('../config/auth');
const { getPool, adminPool } = require('../config/database');

//#endregion
api.post('/login', async (req, res) => {
    const { user, password } = req.body;

    try {
        // Crear pool de conexión con las credenciales del usuario
        const pool = getPool(user, password);

        // Probar la conexión
        const client = await pool.connect();
        await client.query('SELECT NOW()'); // Query simple para probar conexión
        client.release();

        // Cerrar el pool temporal
        await pool.end();

        // Si la conexión es exitosa, se genera un token
        console.log(`El usuario ${user} se conectó a PostgreSQL exitosamente`);
        const token = jwt.sign({ user, password }, SECRET, { expiresIn: '1h' });
        res.json({
            token
        });
    } catch (err) {
        // Manejo de errores específicos de PostgreSQL
        if (err.code === '28P01' || err.code === '28000') { // Invalid password
            res.status(401).json({
                error: 'Usuario o contraseña incorrectos'
            });
        } else if (err.code === '3D000') { // Invalid database name
            res.status(401).json({
                error: 'Base de datos no encontrada'
            });
        } else {
            console.error('Error al conectar a PostgreSQL:', err);
            res.status(500).json({
                error: 'Error al conectar a PostgreSQL',
                details: err.message
            });
        }
    }
});

api.get('/privilegios', verificar, async (req, res) => {
    let client;
    try {
        const pool = getPool(req.user, req.password);
        client = await pool.connect();

        // Consultar los roles y privilegios del usuario actual
        const result = await client.query(`
            SELECT 
                rolsuper, 
                rolinherit, 
                rolcreaterole, 
                rolcreatedb, 
                rolcanlogin, 
                rolreplication, 
                rolbypassrls,
                rolconnlimit
            FROM pg_roles 
            WHERE rolname = current_user
        `);

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Usuario no encontrado en pg_roles'
            });
        }

        const userRole = result.rows[0];
        const privileges = [];

        // Mapear los privilegios booleanos a nombres descriptivos
        if (userRole.rolsuper) {
            privileges.push('SUPERUSER');
        }
        
        if (userRole.rolinherit) {
            privileges.push('INHERIT ROLE');
        }
        
        if (userRole.rolcreaterole) {
            privileges.push('CREATE ROLE');
        }
        
        if (userRole.rolcreatedb) {
            privileges.push('CREATE DATABASE');
        }
        
        if (userRole.rolcanlogin) {
            privileges.push('LOGIN');
        }
        
        if (userRole.rolreplication) {
            privileges.push('REPLICATION');
        }
        
        if (userRole.rolbypassrls) {
            privileges.push('BYPASS ROW LEVEL SECURITY');
        }

        // Verificar privilegios adicionales
        const dbPrivs = await client.query(`
            SELECT has_database_privilege(current_user, current_database(), 'CONNECT') as can_connect,
                   has_database_privilege(current_user, current_database(), 'CREATE') as can_create_schema,
                   has_database_privilege(current_user, current_database(), 'TEMP') as can_create_temp
        `);

        if (dbPrivs.rows[0].can_connect) {
            privileges.push('CONNECT DATABASE');
        }
        
        if (dbPrivs.rows[0].can_create_schema) {
            privileges.push('CREATE SCHEMA');
        }
        
        if (dbPrivs.rows[0].can_create_temp) {
            privileges.push('CREATE TEMP TABLE');
        }

        // Verificar privilegios en el esquema public
        const schemaPrivs = await client.query(`
            SELECT has_schema_privilege(current_user, 'public', 'CREATE') as can_create_in_public,
                   has_schema_privilege(current_user, 'public', 'USAGE') as can_use_public
        `);

        if (schemaPrivs.rows[0].can_create_in_public) {
            privileges.push('CREATE TABLE');
        }
        
        if (schemaPrivs.rows[0].can_use_public) {
            privileges.push('USAGE ON SCHEMA');
        }

        console.log(`El usuario ${req.user} solicitó los privilegios de PostgreSQL exitosamente`);

        res.json({
            result: privileges
        });

    } catch (err) {
        console.error('Error al solicitar privilegios a PostgreSQL:\n', err);
        res.status(500).json({
            error: 'Error al solicitar privilegios a PostgreSQL',
            details: err.message
        });
    } finally {
        // Siempre liberar el cliente
        if (client) {
            client.release();
        }
    }
});

api.get('/rol', verificar, async (req, res) => {
    try {
        const pool = getPool(req.user, req.password);
        const client = await pool.connect();

        // En PostgreSQL, consultamos los roles del usuario actual
        const result = await client.query(`
            SELECT rolname 
            FROM pg_roles 
            WHERE pg_has_role(current_user, rolname, 'member')
        `);

        client.release();
        await pool.end();

        console.log(`El usuario ${req.user} solicitó los roles de PostgreSQL exitosamente`);

        res.json(result.rows.map(row => row.rolname));
    } catch (err) {
        console.error('Error al solicitar roles a PostgreSQL:\n', err);
        res.status(500).json({
            error: 'Error al solicitar roles a PostgreSQL',
            details: err.message
        });
    }
});

api.get('/tablas', verificar, async (req, res) => {
    let client;
    try {
        const pool = getPool(req.user, req.password);
        client = await pool.connect();

        // Consultar todas las tablas y privilegios del usuario actual
        const result = await client.query(`
            SELECT 
                table_schema as owner,
                table_name, 
                privilege_type 
            FROM information_schema.role_table_grants
            WHERE grantee = current_user 
            AND table_schema NOT IN ('information_schema', 'pg_catalog')
            ORDER BY table_schema, table_name, privilege_type
        `);

        // Agrupar los privilegios por tabla
        const tablesMap = new Map();

        result.rows.forEach(row => {
            const key = `${row.owner}.${row.table_name}`;
            
            if (!tablesMap.has(key)) {
                tablesMap.set(key, {
                    owner: row.owner,
                    table_name: row.table_name,
                    privileges: {
                        select: false,
                        insert: false,
                        update: false,
                        delete: false
                    }
                });
            }

            const table = tablesMap.get(key);
            
            // Mapear los tipos de privilegios de PostgreSQL a formato esperado
            switch (row.privilege_type.toLowerCase()) {
                case 'select':
                    table.privileges.select = true;
                    break;
                case 'insert':
                    table.privileges.insert = true;
                    break;
                case 'update':
                    table.privileges.update = true;
                    break;
                case 'delete':
                    table.privileges.delete = true;
                    break;
                case 'truncate':
                    // PostgreSQL tiene TRUNCATE, pero no lo incluimos en el formato Oracle
                    break;
                case 'references':
                    // PostgreSQL tiene REFERENCES, pero no lo incluimos en el formato Oracle
                    break;
                case 'trigger':
                    // PostgreSQL tiene TRIGGER, pero no lo incluimos en el formato Oracle
                    break;
            }
        });

        // Convertir el Map a array
        const tables = Array.from(tablesMap.values());

        console.log(`El usuario ${req.user} solicitó las tablas de PostgreSQL exitosamente`);

        res.json({
            result: tables
        });

    } catch (err) {
        console.error('Error al solicitar tablas a PostgreSQL:\n', err);
        res.status(500).json({
            error: 'Error al solicitar tablas a PostgreSQL',
            details: err.message
        });
    } finally {
        if (client) {
            client.release();
        }
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
        const pool = getPool(req.user, req.password);
        const client = await pool.connect();

        // En PostgreSQL, consultamos los tipos de columnas con información detallada
        const result = await client.query(`
            SELECT 
                column_name, 
                data_type,
                udt_name,
                character_maximum_length,
                numeric_precision, 
                numeric_scale,
                is_nullable,
                column_default,
                ordinal_position
            FROM information_schema.columns
            WHERE table_schema = $1 AND table_name = $2
            ORDER BY ordinal_position
        `, [owner.toLowerCase(), table_name.toLowerCase()]);

        client.release();
        await pool.end();

        console.log(`El usuario ${req.user} solicitó los tipos de columnas para ${owner}.${table_name} de PostgreSQL exitosamente`);

        // Formatea la respuesta para que sea compatible con Oracle
        const columns = result.rows.map(row => {
            let type = row.udt_name.toUpperCase();

            // Mapear tipos de PostgreSQL a tipos compatibles con Oracle
            switch (type) {
                case 'VARCHAR':
                    type = 'VARCHAR2';
                    break;
                case 'BPCHAR':
                    type = 'CHAR';
                    break;
                case 'INT4':
                    type = 'NUMBER';
                    break;
                case 'INT8':
                    type = 'NUMBER';
                    break;
                case 'FLOAT8':
                    type = 'NUMBER';
                    break;
                case 'NUMERIC':
                    type = 'NUMBER';
                    break;
                case 'TIMESTAMP':
                    type = 'DATE';
                    break;
                case 'TIMESTAMPTZ':
                    type = 'TIMESTAMP WITH TIME ZONE';
                    break;
                case 'TEXT':
                    type = 'CLOB';
                    break;
                case 'BOOL':
                    type = 'CHAR';
                    break;
            }

            return {
                name: row.column_name.toUpperCase(),
                type: type,
                length: row.character_maximum_length || (row.numeric_precision ? row.numeric_precision : null),
                precision: row.numeric_precision,
                scale: row.numeric_scale,
                nullable: row.is_nullable === 'YES' ? 'Y' : 'N',
                default_value: row.column_default
            };
        }); res.json({
            columns,
            table_info: {
                schema: owner.toUpperCase(),
                table_name: table_name.toUpperCase(),
                column_count: columns.length
            }
        });
    } catch (err) {
        console.error('Error al solicitar tipos de columnas a PostgreSQL:\n', err);
        res.status(500).json({
            error: 'Error al solicitar tipos de columnas a PostgreSQL',
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
        const pool = getPool(req.user, req.password);
        const client = await pool.connect();

        // Verificar primero si el usuario tiene acceso a la tabla
        const accessCheck = await client.query(`
            SELECT has_table_privilege($1, $2, 'SELECT') as has_access
        `, [req.user, `"${owner}"."${table_name}"`]);

        if (!accessCheck.rows[0].has_access) {
            client.release();
            await pool.end();
            return res.status(403).json({
                error: 'No tienes permisos para acceder a esta tabla'
            });
        }

        // Obtener estructura de columnas con información detallada
        const columnResult = await client.query(`
            SELECT 
                column_name, 
                data_type,
                udt_name,
                character_maximum_length,
                numeric_precision,
                numeric_scale,
                is_nullable,
                ordinal_position
            FROM information_schema.columns
            WHERE table_schema = $1 AND table_name = $2
            ORDER BY ordinal_position
        `, [owner.toLowerCase(), table_name.toLowerCase()]);

        // Obtener datos de la tabla (máximo 1000 filas por rendimiento)
        const dataResult = await client.query(`
            SELECT * FROM "${owner}"."${table_name}" 
            LIMIT 1000
        `);

        client.release();
        await pool.end();

        console.log(`El usuario ${req.user} consultó la tabla ${owner}.${table_name} exitosamente`);

        const columns = columnResult.rows.map(col => ({
            name: col.column_name.toUpperCase(),
            type: col.udt_name.toUpperCase(),
            length: col.character_maximum_length,
            precision: col.numeric_precision,
            scale: col.numeric_scale,
            nullable: col.is_nullable === 'YES' ? 'Y' : 'N'
        }));

        // Convertir datos al formato Oracle (arrays de arrays)
        const rows = dataResult.rows.map(row => {
            return columnResult.rows.map(col => row[col.column_name]);
        });

        res.json({
            table_info: {
                schema: owner.toUpperCase(),
                table_name: table_name.toUpperCase(),
                row_count: dataResult.rows.length,
                columns: columns
            },
            columns: columnResult.rows.map(col => col.column_name.toUpperCase()),
            data: rows
        });
    } catch (err) {
        console.error('Error al solicitar tabla a PostgreSQL:\n', err);
        res.status(500).json({
            error: 'Error al solicitar tabla a PostgreSQL',
            details: err.message
        });
    }
});

api.post('/script/ejecutar-personalizado', verificar, async (req, res) => {
    try {
        const pool = getPool(req.user, req.password);
        const client = await pool.connect();

        const query = req.body.query.trim();

        // Detectar si es PL/pgSQL (contiene DO, DECLARE, o bloques)
        const isPLpgSQL = /^(DO|DECLARE)\s/i.test(query) ||
            /DO\s*\$\$[\s\S]*\$\$\s*;?\s*$/i.test(query) ||
            /BEGIN\s[\s\S]*END\s*;?\s*$/i.test(query);

        if (isPLpgSQL) {
            // Para PL/pgSQL, ejecutamos y capturamos los notices
            let notices = [];

            // Capturar los RAISE NOTICE
            client.on('notice', (notice) => {
                notices.push(notice.message);
            });

            await client.query(query);

            client.release();
            await pool.end();

            console.log(`El usuario ${req.user} ejecutó el siguiente script PL/pgSQL\n${query}\n`);

            res.json({
                message: 'Script PL/pgSQL ejecutado correctamente',
                output: notices.length > 0 ? notices.join('\n') : 'Script ejecutado sin mensajes de salida.'
            });
        } else {
            // Ejecutar como consulta SQL normal
            const result = await client.query(query);

            client.release();
            await pool.end();

            console.log(`El usuario ${req.user} ejecutó la siguiente consulta SQL\n${query}\n`);

            // Convertir al formato original (arrays de arrays)
            const rows = result.rows.map(row => {
                return result.fields.map(field => row[field.name]);
            });

            res.json({
                message: 'Consulta SQL ejecutada correctamente',
                result: rows,
                columns: result.fields ? result.fields.map(field => field.name) : []
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
        const pool = getPool(req.user, req.password);
        const client = await pool.connect();

        // Capturar los notices
        let notices = [];
        client.on('notice', (notice) => {
            notices.push(notice.message);
        });

        // Script migrado de PL/SQL a PL/pgSQL
        const plpgsqlScript = `
            DO $$
            DECLARE
                -- Variables principales para fechas
                v_fecha DATE := '2025-06-11'::DATE;
                v_proximo_dia DATE;
                v_dia_anterior DATE;
                v_anio INTEGER;
                v_anio_anterior INTEGER;
                v_anio_siguiente INTEGER;
                v_bisiesto VARCHAR(3) := 'No';

                -- Variables para tipos de datos
                v_char CHAR(10) := 'TextoA';
                v_varchar VARCHAR(20) := 'Texto B';
                v_numeric NUMERIC(10,2) := 12345.67;
                v_integer INTEGER := -100;
                v_timestamp_with_date TIMESTAMP := '2025-06-11 10:30:00'::TIMESTAMP;
                v_timestamp_now TIMESTAMP := NOW();
                v_timestamptz TIMESTAMPTZ := NOW();
                v_interval_months INTERVAL := '2 years 6 months'::INTERVAL;
                v_interval_days INTERVAL := '5 days 12 hours 30 minutes 45.123456 seconds'::INTERVAL;
            BEGIN
                -- SECCIÓN 1: OPERACIONES CON FECHAS
                RAISE NOTICE '============================================================================';
                RAISE NOTICE '                           OPERACIONES CON FECHAS';
                RAISE NOTICE '============================================================================';
                
                -- Cálculo de próximos y anteriores días
                v_proximo_dia := v_fecha + INTERVAL '1 day';
                v_dia_anterior := v_fecha - INTERVAL '1 day';

                -- Extracción del año y cálculo de año anterior y siguiente
                v_anio := EXTRACT(YEAR FROM v_fecha);
                v_anio_anterior := v_anio - 1;
                v_anio_siguiente := v_anio + 1;

                -- Comprobación de año bisiesto
                IF (v_anio % 4 = 0 AND v_anio % 100 != 0) OR (v_anio % 400 = 0) THEN
                    v_bisiesto := 'Sí';
                END IF;

                -- Mostrar resultados de fechas
                RAISE NOTICE 'Fecha original:         %', v_fecha;
                RAISE NOTICE 'Día anterior:           %', v_dia_anterior;
                RAISE NOTICE 'Próximo día:            %', v_proximo_dia;
                RAISE NOTICE 'Año actual:             %', v_anio;
                RAISE NOTICE 'Año anterior:           %', v_anio_anterior;
                RAISE NOTICE 'Año siguiente:          %', v_anio_siguiente;
                RAISE NOTICE '¿Es bisiesto?:          %', v_bisiesto;

                -- Otras operaciones comunes con fechas
                RAISE NOTICE 'Fecha más 1 semana:     %', v_fecha + INTERVAL '7 days';
                RAISE NOTICE 'Fecha más 1 mes:        %', v_fecha + INTERVAL '1 month';
                RAISE NOTICE 'Fecha más 1 año:        %', v_fecha + INTERVAL '1 year';
                RAISE NOTICE 'Último día del mes:     %', (DATE_TRUNC('month', v_fecha) + INTERVAL '1 month - 1 day')::DATE;

                -- SECCIÓN 2: TIPOS DE DATOS
                RAISE NOTICE '';
                RAISE NOTICE '================================================================================';
                RAISE NOTICE '                            TIPOS DE DATOS POSTGRESQL';
                RAISE NOTICE '================================================================================';

                -- Mostrar tipos de datos (PostgreSQL no tiene RPAD nativo, usamos alternativa)
                RAISE NOTICE 'TIPO DE DATO                   VALOR';
                RAISE NOTICE '--------------------------------------------------------------------------------';
                RAISE NOTICE 'CHAR                           %', v_char;
                RAISE NOTICE 'VARCHAR                        %', v_varchar;
                RAISE NOTICE 'NUMERIC                        %', v_numeric;
                RAISE NOTICE 'INTEGER                        %', v_integer;
                RAISE NOTICE 'TIMESTAMP                      %', v_timestamp_with_date;
                RAISE NOTICE 'TIMESTAMP (NOW)                %', v_timestamp_now;
                RAISE NOTICE 'TIMESTAMPTZ                    %', v_timestamptz;
                RAISE NOTICE 'INTERVAL (YEARS-MONTHS)        %', v_interval_months;
                RAISE NOTICE 'INTERVAL (DAYS-SECONDS)        %', v_interval_days;

                -- Línea final
                RAISE NOTICE '--------------------------------------------------------------------------------';
                RAISE NOTICE '';
                RAISE NOTICE '================================================================================';
                RAISE NOTICE '                              FIN DEL PROGRAMA';
                RAISE NOTICE '================================================================================';
            END $$;
        `;

        await client.query(plpgsqlScript);

        client.release();
        await pool.end();

        console.log(`El usuario ${req.user} ejecutó el script combinado de tiempo y tipos de datos`);

        res.json({
            message: 'Script PL/pgSQL ejecutado correctamente',
            output: notices.length > 0 ? notices.join('\n') : 'Script ejecutado sin mensajes de salida.'
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
        const pool = getPool(req.user, req.password);
        const client = await pool.connect();

        // Capturar los notices
        let notices = [];
        client.on('notice', (notice) => {
            notices.push(notice.message);
        });

        // Script migrado para PostgreSQL - asumiendo que existe un esquema 'hr' con tabla 'employees'
        const plpgsqlScript = `
            DO $$
            DECLARE
                v_total_empleados INTEGER;
            BEGIN
                -- Obtener el total de empleados
                SELECT COUNT(*) INTO v_total_empleados
                FROM hr.employees;

                -- Mostrar el resultado
                RAISE NOTICE 'Total de empleados: %', v_total_empleados;
            END $$;
        `;

        await client.query(plpgsqlScript);

        client.release();
        await pool.end();

        console.log(`El usuario ${req.user} ejecutó el script de total de empleados HR`);

        res.json({
            message: 'Script de total empleados ejecutado correctamente',
            output: notices.length > 0 ? notices.join('\n') : 'Script ejecutado sin mensajes de salida.'
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
        const pool = getPool(req.user, req.password);
        const client = await pool.connect();

        // Capturar los notices
        let notices = [];
        client.on('notice', (notice) => {
            notices.push(notice.message);
        });

        // Script migrado para PostgreSQL - obtener información de la base de datos
        const plpgsqlScript = `
            DO $$
            DECLARE
                v_nombre_bd TEXT;
                v_fecha_crea TIMESTAMP;
            BEGIN
                -- Obtener nombre de la base de datos actual
                SELECT current_database() INTO v_nombre_bd;
                
                -- En PostgreSQL, obtener la fecha de creación es más complejo
                -- Usaremos la fecha de creación del directorio de datos como aproximación
                SELECT pg_postmaster_start_time() INTO v_fecha_crea;

                -- Mostrar los valores
                RAISE NOTICE 'Nombre de la base de datos: %', v_nombre_bd;
                RAISE NOTICE 'Fecha de inicio del servidor: %', v_fecha_crea;
            END $$;
        `;

        await client.query(plpgsqlScript);

        client.release();
        await pool.end();

        console.log(`El usuario ${req.user} ejecutó el script de información de la base de datos`);

        res.json({
            message: 'Script de información de base de datos ejecutado correctamente',
            output: notices.length > 0 ? notices.join('\n') : 'Script ejecutado sin mensajes de salida.'
        });
    } catch (err) {
        console.error('Error al ejecutar el script de información de base de datos:\n', err);
        res.status(500).json({
            error: 'Error al ejecutar el script de información de base de datos',
            details: err.message
        });
    }
});

api.get('/test', (req, res) => {
    res.json({ message: true });
});

// Endpoint adicional para testing de PostgreSQL
api.get('/test/connection', verificar, async (req, res) => {
    try {
        const pool = getPool(req.user, req.password);
        const client = await pool.connect();

        const result = await client.query('SELECT current_database() as database, current_user as user, NOW() as timestamp');

        client.release();
        await pool.end();

        res.json({
            message: 'Conexión PostgreSQL exitosa',
            data: result.rows[0]
        });
    } catch (err) {
        console.error('Error en test de conexión:', err);
        res.status(500).json({
            error: 'Error en test de conexión',
            details: err.message
        });
    }
});

module.exports = api;