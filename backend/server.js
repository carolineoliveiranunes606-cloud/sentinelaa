const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();

// =====================================================
// CONFIGURAÇÕES
// =====================================================

app.use(cors());
app.use(express.json());

// Servir arquivos do frontend
app.use(express.static(path.join(__dirname, "../frontend")));

// =====================================================
// BANCO DE DADOS
// =====================================================

const DB_FILE = path.join(__dirname, "db.json");

function criarBancoPadrao() {
  return {
    usuarios: [],
    pacientes: [],
    triagens: [],
    consultas: [],
    tv_chamada: null,
    tv_historico: []
  };
}

function readDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const banco = criarBancoPadrao();
      writeDB(banco);
      return banco;
    }

    const conteudo = fs.readFileSync(DB_FILE, "utf8");

    if (!conteudo.trim()) {
      const banco = criarBancoPadrao();
      writeDB(banco);
      return banco;
    }

    const db = JSON.parse(conteudo);

    // Garantir estrutura do banco
    if (!Array.isArray(db.usuarios)) {
      db.usuarios = [];
    }

    if (!Array.isArray(db.pacientes)) {
      db.pacientes = [];
    }

    if (!Array.isArray(db.triagens)) {
      db.triagens = [];
    }

    if (!Array.isArray(db.consultas)) {
      db.consultas = [];
    }

    if (!Object.prototype.hasOwnProperty.call(db, "tv_chamada")) {
      db.tv_chamada = null;
    }

    if (!Array.isArray(db.tv_historico)) {
      db.tv_historico = [];
    }

    return db;

  } catch (erro) {
    console.error("Erro ao ler banco de dados:", erro);

    const banco = criarBancoPadrao();
    writeDB(banco);

    return banco;
  }
}

function writeDB(data) {
  try {
    fs.writeFileSync(
      DB_FILE,
      JSON.stringify(data, null, 2),
      "utf8"
    );
  } catch (erro) {
    console.error("Erro ao salvar banco de dados:", erro);
    throw erro;
  }
}

// =====================================================
// ROTA PRINCIPAL
// =====================================================

app.get("/", (req, res) => {
  res.status(200).json({
    status: "online",
    sistema: "Sentineela",
    mensagem: "API Sentineela funcionando corretamente"
  });
});

// =====================================================
// HEALTH CHECK
// =====================================================

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok"
  });
});

// =====================================================
// LOGIN
// =====================================================

app.post("/login", (req, res) => {
  try {
    const db = readDB();

    const usuario = req.body.usuario;
    const senha = req.body.senha;

    const user = db.usuarios.find(
      (u) =>
        u.usuario === usuario &&
        u.senha === senha
    );

    if (!user) {
      return res.status(401).json({
        erro: "Login inválido"
      });
    }

    return res.status(200).json(user);

  } catch (erro) {
    console.error("Erro no login:", erro);

    return res.status(500).json({
      erro: "Erro interno no servidor"
    });
  }
});

// =====================================================
// ATENDIMENTO - CADASTRAR PACIENTE
// =====================================================

app.post("/atendimento", (req, res) => {
  try {
    const db = readDB();

    const paciente = {
      id: Date.now(),
      nome: req.body.nome || "",
      cpf: req.body.cpf || "",
      tipo: req.body.tipo || "",
      status: "triagem",
      createdAt: new Date().toISOString()
    };

    db.pacientes.push(paciente);

    writeDB(db);

    return res.status(201).json(paciente);

  } catch (erro) {
    console.error("Erro ao cadastrar paciente:", erro);

    return res.status(500).json({
      erro: "Erro ao cadastrar paciente"
    });
  }
});

// =====================================================
// LISTAR PACIENTES
// =====================================================

app.get("/pacientes", (req, res) => {
  try {
    const db = readDB();

    return res.status(200).json(db.pacientes);

  } catch (erro) {
    console.error("Erro ao listar pacientes:", erro);

    return res.status(500).json({
      erro: "Erro ao listar pacientes"
    });
  }
});

// =====================================================
// TRIAGEM
// =====================================================

app.post("/triagem", (req, res) => {
  try {
    const db = readDB();

    const temperatura = Number(req.body.temperatura);

    let risco = req.body.risco || "";

    if (!Number.isNaN(temperatura)) {
      if (temperatura >= 39) {
        risco = "vermelho";
      } else if (temperatura >= 38) {
        risco = "amarelo";
      } else if (!risco) {
        risco = "verde";
      }
    } else if (!risco) {
      risco = "verde";
    }

    const triagem = {
      id: Date.now(),
      nome: req.body.nome || "",
      sintoma: req.body.sintoma || "",
      temperatura: req.body.temperatura || "",
      alergia: req.body.alergia || "",
      observacao: req.body.observacao || "",
      risco,
      status: "aguardando_medico",
      createdAt: new Date().toISOString()
    };

    db.triagens.push(triagem);

    writeDB(db);

    return res.status(201).json(triagem);

  } catch (erro) {
    console.error("Erro ao salvar triagem:", erro);

    return res.status(500).json({
      erro: "Erro ao salvar triagem"
    });
  }
});

// =====================================================
// LISTAR TRIAGENS
// =====================================================

app.get("/triagens", (req, res) => {
  try {
    const db = readDB();

    return res.status(200).json(db.triagens);

  } catch (erro) {
    console.error("Erro ao listar triagens:", erro);

    return res.status(500).json({
      erro: "Erro ao listar triagens"
    });
  }
});

// =====================================================
// TV - CHAMAR PACIENTE
// =====================================================

app.post("/tv/chamar", (req, res) => {
  try {
    const db = readDB();

    const chamada = {
      id: Date.now().toString(),
      localTipo: req.body.localTipo || "",
      localNumero: req.body.localNumero || "",
      paciente: req.body.paciente || "",
      hora: new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit"
      })
    };

    db.tv_chamada = chamada;

    db.tv_historico.unshift(chamada);

    // Manter somente as últimas 5 chamadas
    if (db.tv_historico.length > 5) {
      db.tv_historico = db.tv_historico.slice(0, 5);
    }

    writeDB(db);

    return res.status(200).json(chamada);

  } catch (erro) {
    console.error("Erro ao chamar paciente:", erro);

    return res.status(500).json({
      erro: "Erro ao realizar chamada"
    });
  }
});

// =====================================================
// TV - CONSULTAR CHAMADA ATUAL
// =====================================================

app.get("/tv/chamada", (req, res) => {
  try {
    const db = readDB();

    return res.status(200).json({
      chamada: db.tv_chamada,
      historico: db.tv_historico
    });

  } catch (erro) {
    console.error("Erro ao consultar TV:", erro);

    return res.status(500).json({
      erro: "Erro ao consultar chamada"
    });
  }
});

// =====================================================
// TV - LIMPAR CHAMADA
// =====================================================

app.delete("/tv/chamada", (req, res) => {
  try {
    const db = readDB();

    db.tv_chamada = null;

    writeDB(db);

    return res.status(200).json({
      sucesso: true
    });

  } catch (erro) {
    console.error("Erro ao limpar chamada:", erro);

    return res.status(500).json({
      erro: "Erro ao limpar chamada"
    });
  }
});

// =====================================================
// LISTA DE MEDICAÇÕES
// =====================================================

app.get("/lista-medicacoes", (req, res) => {
  return res.status(200).json([
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

// =====================================================
// CONSULTA MÉDICA - SALVAR
// =====================================================

app.post("/consulta", (req, res) => {
  try {
    const db = readDB();

    const consulta = {
      id: Date.now(),
      paciente: req.body.paciente || "",
      diagnostico: req.body.diagnostico || "",
      medicacao: req.body.medicacao || "",
      obs: req.body.obs || "",
      createdAt: new Date().toISOString()
    };

    db.consultas.push(consulta);

    writeDB(db);

    return res.status(201).json(consulta);

  } catch (erro) {
    console.error("Erro ao salvar consulta:", erro);

    return res.status(500).json({
      erro: "Erro ao salvar consulta"
    });
  }
});

// =====================================================
// CONSULTAS - LISTAR
// =====================================================

app.get("/consultas", (req, res) => {
  try {
    const db = readDB();

    return res.status(200).json(db.consultas);

  } catch (erro) {
    console.error("Erro ao listar consultas:", erro);

    return res.status(500).json({
      erro: "Erro ao listar consultas"
    });
  }
});

// =====================================================
// COMPATIBILIDADE COM ROTA ANTIGA
// =====================================================

app.get("/medicacoes", (req, res) => {
  try {
    const db = readDB();

    return res.status(200).json(db.consultas);

  } catch (erro) {
    console.error("Erro ao listar consultas:", erro);

    return res.status(500).json({
      erro: "Erro ao listar consultas"
    });
  }
});

// =====================================================
// ROTA 404
// =====================================================

app.use((req, res) => {
  return res.status(404).json({
    erro: "Rota não encontrada",
    rota: req.originalUrl
  });
});

// =====================================================
// TRATAMENTO DE ERROS
// =====================================================

app.use((erro, req, res, next) => {
  console.error("Erro interno:", erro);

  return res.status(500).json({
    erro: "Erro interno no servidor"
  });
});

// =====================================================
// INICIAR SERVIDOR
// =====================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("======================================");
  console.log("       SENTINEELA API ONLINE");
  console.log("======================================");
  console.log(`Porta: ${PORT}`);
  console.log("Host: 0.0.0.0");
  console.log("======================================");
});
