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

// --- KATEGORIE ---
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

// --- PYTANIA ---

// GET: Pobierz pytania (zawiera poprawkę z category_id)
app.get('/api/questions', (req, res) => {
    const sql = `
        SELECT q.id as q_id, q.question_text, q.category_id, c.name as category_name, 
               a.id as a_id, a.answer_text, a.is_correct
        FROM questions q
        LEFT JOIN categories c ON q.category_id = c.id
        LEFT JOIN answers a ON q.id = a.question_id
        ORDER BY q.id, a.id
    `;

    db.query(sql, (err, results) => {
        if (err) return res.status(500).json(err);

        const questionsMap = new Map();
        results.forEach(row => {
            if (!questionsMap.has(row.q_id)) {
                questionsMap.set(row.q_id, {
                    id: row.q_id,
                    question: row.question_text,
                    categoryId: row.category_id,
                    category: row.category_name,
                    answers: []
                });
            }
            if (row.a_id) {
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

// POST: Dodawanie pytania
app.post('/api/questions', (req, res) => {
    const { question, answers, categoryId } = req.body; 
    
    // Zabezpieczenie: jeśli categoryId jest puste, wstawiamy NULL (lub baza zwróci błąd jeśli pole jest NOT NULL)
    const catId = categoryId === "" ? null : categoryId;

    db.query('INSERT INTO questions (question_text, category_id) VALUES (?, ?)', 
    [question, catId], (err, result) => {
        if (err) {
            console.error("Błąd SQL (Dodawanie):", err); // Logowanie błędu w konsoli serwera
            return res.status(500).json({ error: err.message });
        }
        
        const questionId = result.insertId;
        const answersValues = answers.map(a => [questionId, a.text, a.isCorrect]);

        db.query('INSERT INTO answers (question_id, answer_text, is_correct) VALUES ?', 
        [answersValues], (err, resAnswers) => {
            if (err) return res.status(500).json(err);
            res.json({ message: 'Dodano pytanie i odpowiedzi' });
        });
    });
});

// PUT: Edycja
app.put('/api/questions/:id', (req, res) => {
    const { question, answers, categoryId } = req.body;
    const questionId = req.params.id;
    const catId = categoryId === "" ? null : categoryId;

    db.query('UPDATE questions SET question_text=?, category_id=? WHERE id=?', 
    [question, catId, questionId], (err) => {
        if (err) {
            console.error("Błąd SQL (Edycja):", err);
            return res.status(500).json(err);
        }

        db.query('DELETE FROM answers WHERE question_id=?', [questionId], (err) => {
            if (err) return res.status(500).json(err);

            const answersValues = answers.map(a => [questionId, a.text, a.isCorrect]);
            db.query('INSERT INTO answers (question_id, answer_text, is_correct) VALUES ?', 
            [answersValues], (err) => {
                if (err) return res.status(500).json(err);
                res.json({ message: 'Zaktualizowano' });
            });
        });
    });
});

// DELETE
app.delete('/api/questions/:id', (req, res) => {
    db.query('DELETE FROM questions WHERE id = ?', [req.params.id], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ message: 'Usunięto' });
    });
});

app.listen(3000, () => {
    console.log('Serwer działa na http://localhost:3000');
    exec('start http://localhost:3000/panel.html', (err) => {});
});