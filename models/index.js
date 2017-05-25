var path = require('path');

// Cargar ORM
var Sequelize = require('sequelize');

// Para usar en local BBDD SQLite:
//  DATABASE_URL = sqlite:///
//    DATABASE_STORAGE = quiz.sqlite
// Para usar en Heroku BBDD Postgres:
//DATABASE_URL = "postgres://ydvqdpbdcfptqc:d5e8cf42a48b3226612a3d09868d8a23ba9c460d29c1e6a653229fe397e32c4c@ec2-54-225-242-74.compute-1.amazonaws.com:5432/d1a24chqdidg6b";

var url, storage;

if (!process.env.DATABASE_URL) {
    url = "sqlite:///";
    storage = "quiz.sqlite";
} else {
    url = process.env.DATABASE_URL;
    storage = process.env.DATABASE_STORAGE || "";
}

var sequelize = new Sequelize(url, {storage: storage});



// Importar la definicion de la tabla Quiz de quiz.js
var Quiz = sequelize.import(path.join(__dirname, 'quiz'));


exports.Quiz = Quiz; // exportar definición de tabla Quiz
