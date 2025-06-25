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

//#region Servir Frontend Angular
const frontendPath = path.join(__dirname, '../Frontend/dist/crud/browser');
app.use(express.static(frontendPath));

app.get('/*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});
//#endregion

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));

