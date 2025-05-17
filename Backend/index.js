//#region Configuración del Servidor
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'dist/crud-oracle')));
//#endregion

//#region Configuración de rutas
const api = require('./routes/api');
app.use('/api', api);

/* TOCA VER LUEGO
const fs = require('fs');
app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, 'dist/crud-oracle/browser/index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('index.html no encontrado');
    }
});*/
//#endregion

app.listen(3000, () => console.log('Backend corriendo en http://localhost:3000'));
