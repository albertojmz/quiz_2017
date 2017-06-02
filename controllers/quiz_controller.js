var models = require("../models");
var Sequelize = require('sequelize');
var session = require('express-session');
var paginate = require('../helpers/paginate').paginate;



// Autoload el quiz asociado a :quizId
exports.load = function (req, res, next, quizId) {


    models.Quiz.findById(quizId, {
        include: [
            models.Tip,
            {model: models.User, as: 'Author'}
        ]
    })


    models.Quiz.findById(quizId, {
        include : [
            {model: models.Tip, include : [{ model: models.User, as: 'Author'}]},
            {model: models.User, as: 'Author'}

        ]
    })

    .then(function (quiz) {
        if (quiz) {
            req.quiz = quiz;
            next();
        } else {
            throw new Error('No existe ningún quiz con id=' + quizId);
        }
    })
    .catch(function (error) {
        next(error);
    });
};


// MW que permite acciones solamente si al usuario logeado es admin o es el autor del quiz.
exports.adminOrAuthorRequired = function(req, res, next){

    var isAdmin  = req.session.user.isAdmin;
    var isAuthor = req.quiz.AuthorId === req.session.user.id;

    if (isAdmin || isAuthor) {
        next();
    } else {
        console.log('Operación prohibida: El usuario logeado no es el autor del quiz, ni un administrador.');
        res.send(403);
    }
};


// GET /quizzes
exports.index = function (req, res, next) {

    var countOptions = {
        where: {}
    };

    var title = "Preguntas";

    // Busquedas:
    var search = req.query.search || '';
    if (search) {
        var search_like = "%" + search.replace(/ +/g,"%") + "%";

        countOptions.where.question = { $like: search_like };
    }

    // Si existe req.user, mostrar solo sus preguntas.
    if (req.user) {
        countOptions.where.AuthorId = req.user.id;
        title = "Preguntas de " + req.user.username;
    }

    models.Quiz.count(countOptions)
    .then(function (count) {

        // Paginacion:

        var items_per_page = 10;

        // La pagina a mostrar viene en la query
        var pageno = parseInt(req.query.pageno) || 1;

        // Crear un string con el HTML que pinta la botonera de paginacion.
        // Lo añado como una variable local de res para que lo pinte el layout de la aplicacion.
        res.locals.paginate_control = paginate(count, items_per_page, pageno, req.url);

        var findOptions = countOptions;

        findOptions.offset = items_per_page * (pageno - 1);
        findOptions.limit = items_per_page;
        findOptions.include = [{model: models.User, as: 'Author'}];

        return models.Quiz.findAll(findOptions);
    })
    .then(function (quizzes) {
        res.render('quizzes/index.ejs', {
            quizzes: quizzes,
            search: search,
            title: title
        });
    })
    .catch(function (error) {
        next(error);
    });
};


// GET /quizzes/:quizId
exports.show = function (req, res, next) {

    res.render('quizzes/show', {quiz: req.quiz});
};


// GET /quizzes/new
exports.new = function (req, res, next) {

    var quiz = {question: "", answer: ""};

    res.render('quizzes/new', {quiz: quiz});
};


// POST /quizzes/create
exports.create = function (req, res, next) {

    var authorId = req.session.user && req.session.user.id || 0;

    var quiz = models.Quiz.build({
        question: req.body.question,
        answer: req.body.answer,
        AuthorId: authorId
    });

    // guarda en DB los campos pregunta y respuesta de quiz
    quiz.save({fields: ["question", "answer", "AuthorId"]})
    .then(function (quiz) {
        req.flash('success', 'Quiz creado con éxito.');
        res.redirect('/quizzes/' + quiz.id);
    })
    .catch(Sequelize.ValidationError, function (error) {

        req.flash('error', 'Errores en el formulario:');
        for (var i in error.errors) {
            req.flash('error', error.errors[i].value);
        }

        res.render('quizzes/new', {quiz: quiz});
    })
    .catch(function (error) {
        req.flash('error', 'Error al crear un Quiz: ' + error.message);
        next(error);
    });
};


// GET /quizzes/:quizId/edit
exports.edit = function (req, res, next) {

    res.render('quizzes/edit', {quiz: req.quiz});
};


// PUT /quizzes/:quizId
exports.update = function (req, res, next) {

    req.quiz.question = req.body.question;
    req.quiz.answer = req.body.answer;

    req.quiz.save({fields: ["question", "answer"]})
    .then(function (quiz) {
        req.flash('success', 'Quiz editado con éxito.');
        res.redirect('/quizzes/' + req.quiz.id);
    })
    .catch(Sequelize.ValidationError, function (error) {

        req.flash('error', 'Errores en el formulario:');
        for (var i in error.errors) {
            req.flash('error', error.errors[i].value);
        }

        res.render('quizzes/edit', {quiz: req.quiz});
    })
    .catch(function (error) {
        req.flash('error', 'Error al editar el Quiz: ' + error.message);
        next(error);
    });
};


// DELETE /quizzes/:quizId
exports.destroy = function (req, res, next) {

    req.quiz.destroy()
    .then(function () {
        req.flash('success', 'Quiz borrado con éxito.');
        res.redirect('/goback');
    })
    .catch(function (error) {
        req.flash('error', 'Error al editar el Quiz: ' + error.message);
        next(error);
    });
};


// GET /quizzes/:quizId/play
exports.play = function (req, res, next) {

    var answer = req.query.answer || '';


    res.render('quizzes/play', {
        quiz: req.quiz,
        answer: answer
    });
};


// GET /quizzes/:quizId/check
exports.check = function (req, res, next) {

    var answer = req.query.answer || "";

    var result = answer.toLowerCase().trim() === req.quiz.answer.toLowerCase().trim();

    res.render('quizzes/result', {
        quiz: req.quiz,
        result: result,
        answer: answer
    });
};

//GET /quizzes/randomplay
exports.randomplay = function (req, res, next) {

    if(!req.session.score || !req.session.answered_right) {
        req.session.score = 0;
        req.session.answered_right = [-1];}

    var answer = req.query.answer || "";

    if(!req.session.wrong){
        req.session.wrong = 0;
    }

    if (req.session.wrong === 1) {
        req.session.score = 0;
    }

    models.Quiz.count()
        .then(function (count) {
            return models.Quiz.findAll(
                {where: {id: { $notIn: req.session.answered_right}}})
        })

        .then(function(not_answered){
            if(not_answered.length == 0) {res.render('quizzes/random_nomore', {
                score: req.session.score
            });
            } else{
                var random = Math.floor(Math.random() * not_answered.length);
                res.render('quizzes/random_play', {
                    quiz: not_answered[random],
                    answer: answer,
                    score: req.session.score
                });
            }
        })
};


// GET /quizzes/randomcheck/:quizId?answer=respuesta
exports.randomcheck = function(req, res, next){

    var answer = req.query.answer || "";

    var result = answer.toLowerCase().trim() === req.quiz.answer.toLowerCase().trim();

    if(result) {
        req.session.score++;
        req.session.wrong = 0;
        req.session.answered_right.push(req.quiz.id);
    }
    else {req.session.wrong = 1;
    req.session.score = 0;}
    res.render('quizzes/random_result', {
        score: req.session.score,
        result: result,
        answer: answer
    });
};



// // GET /quizzes/randomplay
// exports.randomplay = function (req, res, next) {
//
//     var answer = req.query.answer || '';
//
//     if (!req.session.score) req.session.score=0;
//     // // quiz = models.Quiz.findOne();
//     // var quiz = models.Quiz.build({
//     //     question: 'Capital de Italia',
//     //     id : 1
//     // });
//     if (!req.session.fallo) req.session.fallo=0;
//     if(req.session.fallo ===1){req.session.score=0;}
//     // if (!req.session.array) {
//     //         tabla = models.Quiz.findAll()
//     //         .then(function (tabla) {
//     //
//     //             if (req.session.score === tabla.length){
//     //                 res.render('quizzes/random_nomore' ,{
//     //                     score: req.session.score
//     //                 })
//     //             }
//     //             res.render('quizzes/random_play', {
//     //
//     //                 score : req.session.score,
//     //                 answer: answer,
//     //                 quiz: tabla[parseInt(Math.random()*tabla.length)]
//     //             });
//     //
//     //         })
//     //
//     // }
//     if (!req.session.preguntas) req.session.preguntas = models.Quiz.findAll();
//     if (!req.session.array) req.session.array = [-1];
//
//     var numero = parseInt(Math.random()*5);
//     quizelegido = models.Quiz.findById(numero)
//         .then(function(quizelegido) {
//
//         })
//         if (req.session.array.indexOf(quizelegido.id)===-1){
//             res.render( 'quizzes/random_play' , {
//                 score: req.session.score,
//                 answer:answer,
//                 quiz:quizelegido
//             })
//         }
//         else {
//
//         }
// };
//
// // GET /quizzes/randomcheck/:quizId
// exports.randomcheck = function (req, res, next) {
//
//
//     var answer = req.query.answer || "";
//
//     var result = answer.toLowerCase().trim() === req.quiz.answer.toLowerCase().trim();
//
//
//
//         if (result){
//             req.session.score++;
//             req.session.fallo=0;
//             req.session.array.push(req.quiz.id);
//         }
//
//         if(!result){
//             req.session.fallo=1;
//         }
//
//
//         res.render('quizzes/random_result', {
//             score: req.session.score,
//             quiz: req.quiz,
//             result: result,
//             answer: answer
//         });
//
//
//
//
//
//
// };
//
//
//

