//#region Configuración del Servidor
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
//#endregion

//#region Configuración de rutas
const api = require('./routes/api');
app.use('/api', api);
//#endregion

app.listen(3000, () => console.log('Backend corriendo en http://localhost:3000'));
