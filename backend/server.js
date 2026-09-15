const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const PDFDocument = require("pdfkit");

const app = express();

app.use(express.json());
app.use(cors());

app.use(express.static(path.join(__dirname, "../frontend")));

const DB_FILE = path.join(__dirname, "db.json");

function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    return {
      usuarios: [],
      pacientes: [],
      triagens: [],
      consultas: []
    };
  }

  return JSON.parse(fs.readFileSync(DB_FILE));
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}


// LOGIN
app.post("/login", (req, res) => {
  const db = readDB();

  const user = db.usuarios.find(u =>
    u.usuario === req.body.usuario &&
    u.senha === req.body.senha
  );

  if (!user) {
    return res.status(401).json({
      erro: "Login inválido"
    });
  }

  res.json(user);
});


// ATENDIMENTO
app.post("/atendimento", (req, res) => {
  const db = readDB();

  const paciente = {
    id: Date.now(),
    nome: req.body.nome,
    cpf: req.body.cpf,
    tipo: req.body.tipo,
    status: "triagem",
    createdAt: new Date()
  };

  db.pacientes.push(paciente);
  writeDB(db);

  res.json(paciente);
});


// TRIAGEM
app.post("/triagem", (req, res) => {
  const db = readDB();

  let risco = req.body.risco;

  if (req.body.temperatura >= 39) {
    risco = "vermelho";
  } else if (req.body.temperatura >= 38) {
    risco = "amarelo";
  } else if (!risco) {
    risco = "verde";
  }

  const triagem = {
    id: Date.now(),
    nome: req.body.nome,
    sintoma: req.body.sintoma,
    temperatura: req.body.temperatura,
    alergia: req.body.alergia,
    observacao: req.body.observacao,
    risco,
    status: "aguardando_medico",
    createdAt: new Date()
  };

  db.triagens.push(triagem);
  writeDB(db);

  res.json(triagem);
});


// LISTAR TRIAGENS
app.get("/triagens", (req, res) => {
  const db = readDB();

  const triagens = db.triagens.filter(
    t => t.status === "aguardando_medico"
  );

  res.json(triagens);
});


// LISTA DE MEDICAÇÕES
app.get("/lista-medicacoes", (req, res) => {
  res.json([
    "Dipirona",
    "Paracetamol",
    "Ibuprofeno",
    "Amoxicilina",
    "Azitromicina",
    "Loratadina",
    "Omeprazol",
    "Buscopan",
    "Dramin",
    "Soro fisiológico"
  ]);
});


// CONSULTA
app.post("/consulta", (req, res) => {
  const db = readDB();

  const consulta = {
    id: Date.now(),
    paciente: req.body.paciente,
    diagnostico: req.body.diagnostico,
    medicacao: req.body.medicacao,
    obs: req.body.obs,
    createdAt: new Date()
  };

  db.consultas.push(consulta);

  writeDB(db);

  res.json(consulta);
});


// =====================================================
// GERAR PDF DE ALTA
// =====================================================

app.post("/alta", (req, res) => {
  const db = readDB();

  const pacienteNome = req.body.paciente;

  // Procura a triagem
  const triagem = db.triagens.find(
    t =>
      t.nome === pacienteNome &&
      t.status === "aguardando_medico"
  );

  if (!triagem) {
    return res.status(404).json({
      erro: "Paciente não encontrado"
    });
  }

  // Procura a consulta mais recente
  const consultasPaciente = db.consultas
    .filter(c => c.paciente === pacienteNome)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const consulta = consultasPaciente[0] || null;

  // Data da alta
  const dataAlta = new Date();

  // Pasta onde os PDFs serão salvos
  const pastaPDF = path.join(__dirname, "pdfs");

  if (!fs.existsSync(pastaPDF)) {
    fs.mkdirSync(pastaPDF);
  }

  // Nome seguro para o arquivo
  const nomeArquivo = pacienteNome
    .replace(/[^a-zA-Z0-9À-ÿ ]/g, "")
    .replace(/\s+/g, "_");

  const nomePDF =
    `alta_${nomeArquivo}_${Date.now()}.pdf`;

  const caminhoPDF =
    path.join(pastaPDF, nomePDF);


  // Cria o PDF
  const doc = new PDFDocument({
    size: "A4",
    margin: 50
  });

  const stream =
    fs.createWriteStream(caminhoPDF);

  doc.pipe(stream);


  // =====================================================
  // CABEÇALHO
  // =====================================================

  doc
    .fontSize(20)
    .font("Helvetica-Bold")
    .text("HOSPITAL PRO", {
      align: "center"
    });

  doc.moveDown(0.5);

  doc
    .fontSize(16)
    .text("FORMULÁRIO DE ALTA MÉDICA", {
      align: "center"
    });

  doc.moveDown();

  doc
    .moveTo(50, doc.y)
    .lineTo(545, doc.y)
    .stroke();

  doc.moveDown();


  // =====================================================
  // DADOS DO PACIENTE
  // =====================================================

  doc
    .fontSize(13)
    .font("Helvetica-Bold")
    .text("DADOS DO PACIENTE");

  doc.moveDown(0.5);

  doc
    .fontSize(11)
    .font("Helvetica");

  doc.text(`Nome: ${triagem.nome || "Não informado"}`);

  doc.text(
    `Data do atendimento: ${
      formatarData(triagem.createdAt)
    }`
  );

  doc.moveDown();


  // =====================================================
  // TRIAGEM
  // =====================================================

  doc
    .fontSize(13)
    .font("Helvetica-Bold")
    .text("DADOS DA TRIAGEM");

  doc.moveDown(0.5);

  doc
    .fontSize(11)
    .font("Helvetica");

  doc.text(
    `Sintoma: ${
      triagem.sintoma ||
      triagem.sintomas ||
      "Não informado"
    }`
  );

  doc.text(
    `Temperatura: ${
      triagem.temperatura ||
      triagem.temp ||
      "Não informada"
    } °C`
  );

  doc.text(
    `Classificação de risco: ${
      triagem.risco ||
      "Não informada"
    }`
  );

  doc.text(
    `Alergia: ${
      triagem.alergia ||
      "Nenhuma"
    }`
  );

  doc.text(
    `Observação da triagem: ${
      triagem.observacao ||
      "Nenhuma"
    }`
  );

  doc.moveDown();


  // =====================================================
  // CONSULTA MÉDICA
  // =====================================================

  doc
    .fontSize(13)
    .font("Helvetica-Bold")
    .text("CONSULTA MÉDICA");

  doc.moveDown(0.5);

  doc
    .fontSize(11)
    .font("Helvetica");

  doc.text(
    `Diagnóstico: ${
      consulta?.diagnostico ||
      "Não informado"
    }`
  );

  doc.text(
    `Medicação: ${
      consulta?.medicacao ||
      "Não informada"
    }`
  );

  doc.text(
    `Observações médicas: ${
      consulta?.obs ||
      "Nenhuma"
    }`
  );

  doc.moveDown();


  // =====================================================
  // ALTA
  // =====================================================

  doc
    .fontSize(13)
    .font("Helvetica-Bold")
    .text("ALTA MÉDICA");

  doc.moveDown(0.5);

  doc
    .fontSize(11)
    .font("Helvetica");

  doc.text(
    `Data e hora da alta: ${formatarData(dataAlta)}`
  );

  doc.moveDown();

  doc.text(
    "Paciente avaliado e liberado para alta médica."
  );

  doc.moveDown(3);


  // =====================================================
  // ASSINATURA
  // =====================================================

  doc
    .moveTo(100, doc.y)
    .lineTo(450, doc.y)
    .stroke();

  doc.moveDown(0.5);

  doc
    .fontSize(10)
    .text(
      "Assinatura e carimbo do médico",
      {
        align: "center"
      }
    );

  doc.moveDown(3);

  doc
    .fontSize(9)
    .fillColor("gray")
    .text(
      "Documento gerado automaticamente pelo sistema Hospital Pro.",
      {
        align: "center"
      }
    );


  // Finaliza PDF
  doc.end();


  // Quando terminar de criar o arquivo
  stream.on("finish", () => {

    // Marca paciente como alta
    triagem.status = "alta";
    triagem.dataAlta = dataAlta;

    writeDB(db);

    // Envia o PDF para o navegador
    res.download(
      caminhoPDF,
      nomePDF,
      error => {

        if (error) {
          console.error(
            "Erro ao enviar PDF:",
            error
          );
        }

      }
    );

  });


  stream.on("error", error => {

    console.error(
      "Erro ao gerar PDF:",
      error
    );

    res.status(500).json({
      erro: "Erro ao gerar formulário de alta."
    });

  });

});


// =====================================================
// FUNÇÃO PARA FORMATAR DATA
// =====================================================

function formatarData(data) {

  if (!data) {
    return "Não informado";
  }

  return new Date(data).toLocaleString(
    "pt-BR",
    {
      dateStyle: "short",
      timeStyle: "short"
    }
  );

}


// MEDICAÇÕES
app.get("/medicacoes", (req, res) => {

  const db = readDB();

  res.json(db.consultas);

});


// START
app.listen(3000, () => {

  console.log(
    "🏥 Hospital Pro rodando em http://localhost:3000"
  );

});
