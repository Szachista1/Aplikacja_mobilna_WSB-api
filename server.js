const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const questions = [
    {
        id: 1,
        question: "Jaka jest stolica Polski?",
        answers: ["Kraków", "Warszawa", "Gdańsk", "Poznań"],
        correctIndex: 1
    },
    {
        id: 2,
        question: "Ile to jest 2 + 2?",
        answers: ["3", "5", "4", "22"],
        correctIndex: 2
    }
];

// Endpoint API
app.get('/api/questions', (req, res) => {
    res.json(questions);
});

// Uruchomienie serwera na porcie 3000
app.listen(3000, '0.0.0.0', () => {
    console.log('Serwer działa na http://localhost:3000');
});