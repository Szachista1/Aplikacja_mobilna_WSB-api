const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const app = express();
const { exec } = require('child_process');
app.use(express.static(__dirname));
app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'quizzwsb'
});

// --- KATEGORIE (Bez zmian) ---
app.get('/api/categories', (req, res) => {
    db.query('SELECT * FROM categories', (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

app.post('/api/categories', (req, res) => {
    db.query('INSERT INTO categories (name) VALUES (?)', [req.body.name], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ id: result.insertId, name: req.body.name });
    });
});

// --- PYTANIA I ODPOWIEDZI ---

// GET: Pobierz pytania wraz z odpowiedziami
app.get('/api/questions', (req, res) => {
    const sql = `
        SELECT q.id as q_id, q.question_text, c.name as category_name, 
               a.id as a_id, a.answer_text, a.is_correct
        FROM questions q
        LEFT JOIN categories c ON q.category_id = c.id
        LEFT JOIN answers a ON q.id = a.question_id
        ORDER BY q.id, a.id
    `;

    db.query(sql, (err, results) => {
        if (err) return res.status(500).json(err);

        // SQL zwraca płaską tabelę (wiele wierszy dla jednego pytania).
        // Musimy to zgrupować w obiekty w JavaScript.
        const questionsMap = new Map();

        results.forEach(row => {
            if (!questionsMap.has(row.q_id)) {
                questionsMap.set(row.q_id, {
                    id: row.q_id,
                    question: row.question_text,
                    category: row.category_name,
                    answers: []
                });
            }
            if (row.a_id) { // Jeśli istnieje odpowiedź
                questionsMap.get(row.q_id).answers.push({
                    id: row.a_id,
                    text: row.answer_text,
                    isCorrect: row.is_correct === 1
                });
            }
        });

        res.json(Array.from(questionsMap.values()));
    });
});

// POST: Dodaj pytanie i odpowiedzi
app.post('/api/questions', (req, res) => {
    const { question, answers, categoryId } = req.body; 
    // answers to tablica obiektów: [{text: "...", isCorrect: true/false}, ...]

    // 1. Dodaj pytanie
    db.query('INSERT INTO questions (question_text, category_id) VALUES (?, ?)', 
    [question, categoryId], (err, result) => {
        if (err) return res.status(500).json(err);
        
        const questionId = result.insertId;

        // 2. Przygotuj dane odpowiedzi do masowego insertu
        // Format dla mysql2: [[qId, text, isCorrect], [qId, text, isCorrect]...]
        const answersValues = answers.map(a => [questionId, a.text, a.isCorrect]);

        db.query('INSERT INTO answers (question_id, answer_text, is_correct) VALUES ?', 
        [answersValues], (err, resAnswers) => {
            if (err) return res.status(500).json(err);
            res.json({ message: 'Dodano pytanie i odpowiedzi' });
        });
    });
});

// DELETE: Usuń pytanie (odpowiedzi usuną się same dzięki ON DELETE CASCADE)
app.delete('/api/questions/:id', (req, res) => {
    db.query('DELETE FROM questions WHERE id = ?', [req.params.id], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ message: 'Usunięto' });
    });
});

// PUT: Edycja (najprościej: zaktualizuj treść, usuń stare odp, dodaj nowe)
app.put('/api/questions/:id', (req, res) => {
    const { question, answers, categoryId } = req.body;
    const questionId = req.params.id;

    // 1. Aktualizuj treść pytania
    db.query('UPDATE questions SET question_text=?, category_id=? WHERE id=?', 
    [question, categoryId, questionId], (err) => {
        if (err) return res.status(500).json(err);

        // 2. Usuń stare odpowiedzi
        db.query('DELETE FROM answers WHERE question_id=?', [questionId], (err) => {
            if (err) return res.status(500).json(err);

            // 3. Dodaj nowe odpowiedzi
            const answersValues = answers.map(a => [questionId, a.text, a.isCorrect]);
            db.query('INSERT INTO answers (question_id, answer_text, is_correct) VALUES ?', 
            [answersValues], (err) => {
                if (err) return res.status(500).json(err);
                res.json({ message: 'Zaktualizowano' });
            });
        });
    });
});

app.listen(3000, () => {
    console.log('Serwer działa na http://localhost:3000');
    
    // <-- 3. Komenda otwierająca przeglądarkę (tylko Windows)
    exec('start http://localhost:3000/panel.html', (err) => {
        if(err) console.error("Nie udało się otworzyć przeglądarki automatycznie:", err);
    });
});