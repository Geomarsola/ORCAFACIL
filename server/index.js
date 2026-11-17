
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool from "./db.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const USUARIO_LOCAL_ID = 1;

// ========================================
// CONFIGURAÇÕES
// ========================================

app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
      ) {
        callback(null, true);
      } else {
        callback(new Error("Origem não permitida pelo CORS"));
      }
    },
    credentials: true,
  })
);

app.use(express.json());

// ========================================
// ROTAS INICIAIS
// ========================================

app.get("/", (req, res) => {
  res.json({ mensagem: "API OrçaFácil funcionando!" });
});

app.get("/api/health", (req, res) => {
  res.json({
    sucesso: true,
    mensagem: "Servidor OrçaFácil funcionando!",
  });
});

app.get("/api/teste-banco", async (req, res) => {
  try {
    const [resultado] = await pool.query(
      "SELECT DATABASE() AS banco, NOW() AS horario"
    );

    res.json({
      sucesso: true,
      mensagem: "Conexão com MySQL realizada!",
      dados: resultado[0],
    });
  } catch (erro) {
    console.error("Erro ao consultar MySQL:", erro);
    res.status(500).json({
      sucesso: false,
      mensagem: "Não foi possível conectar ao banco.",
    });
  }
});

// ========================================
// LISTAR CLIENTES
// ========================================

app.get("/api/clientes", async (req, res) => {
  try {
    const [clientes] = await pool.query(
      `SELECT
        id,
        nome,
        telefone,
        email,
        cpf_cnpj AS documento,
        endereco,
        observacoes
       FROM clientes
       WHERE usuario_id = ?
       ORDER BY id DESC`,
      [USUARIO_LOCAL_ID]
    );

    res.json(clientes);
  } catch (erro) {
    console.error("Erro ao listar clientes:", erro);
    res.status(500).json({
      mensagem: "Erro ao buscar clientes.",
    });
  }
});

// ========================================
// CADASTRAR CLIENTE
// ========================================

app.post("/api/clientes", async (req, res) => {
  try {
    const {
      nome,
      telefone,
      email,
      documento,
      endereco,
      observacoes,
    } = req.body;

    if (!nome || !nome.trim()) {
      return res.status(400).json({
        mensagem: "O nome do cliente é obrigatório.",
      });
    }

    const [resultado] = await pool.query(
      `INSERT INTO clientes
        (usuario_id, nome, telefone, email, cpf_cnpj, endereco, observacoes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        USUARIO_LOCAL_ID,
        nome.trim(),
        telefone || null,
        email || null,
        documento || null,
        endereco || null,
        observacoes || null,
      ]
    );

    const [clientes] = await pool.query(
      `SELECT
        id,
        nome,
        telefone,
        email,
        cpf_cnpj AS documento,
        endereco,
        observacoes
       FROM clientes
       WHERE id = ? AND usuario_id = ?`,
      [resultado.insertId, USUARIO_LOCAL_ID]
    );

    res.status(201).json({
      mensagem: "Cliente cadastrado com sucesso!",
      cliente: clientes[0],
    });
  } catch (erro) {
    console.error("Erro ao cadastrar cliente:", erro);
    res.status(500).json({
      mensagem: "Erro ao cadastrar cliente.",
    });
  }
});

// ========================================
// EDITAR CLIENTE
// ========================================

app.put("/api/clientes/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const {
      nome,
      telefone,
      email,
      documento,
      endereco,
      observacoes,
    } = req.body;

    if (!nome || !nome.trim()) {
      return res.status(400).json({
        mensagem: "O nome do cliente é obrigatório.",
      });
    }

    const [resultado] = await pool.query(
      `UPDATE clientes
       SET nome = ?,
           telefone = ?,
           email = ?,
           cpf_cnpj = ?,
           endereco = ?,
           observacoes = ?
       WHERE id = ? AND usuario_id = ?`,
      [
        nome.trim(),
        telefone || null,
        email || null,
        documento || null,
        endereco || null,
        observacoes || null,
        id,
        USUARIO_LOCAL_ID,
      ]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({
        mensagem: "Cliente não encontrado.",
      });
    }

    const [clientes] = await pool.query(
      `SELECT
        id,
        nome,
        telefone,
        email,
        cpf_cnpj AS documento,
        endereco,
        observacoes
       FROM clientes
       WHERE id = ? AND usuario_id = ?`,
      [id, USUARIO_LOCAL_ID]
    );

    res.json({
      mensagem: "Cliente atualizado com sucesso!",
      cliente: clientes[0],
    });
  } catch (erro) {
    console.error("Erro ao atualizar cliente:", erro);
    res.status(500).json({
      mensagem: "Erro ao atualizar cliente.",
    });
  }
});

// ========================================
// EXCLUIR CLIENTE
// ========================================

app.delete("/api/clientes/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [resultado] = await pool.query(
      `DELETE FROM clientes
       WHERE id = ? AND usuario_id = ?`,
      [id, USUARIO_LOCAL_ID]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({
        mensagem: "Cliente não encontrado.",
      });
    }

    res.json({
      mensagem: "Cliente excluído com sucesso!",
    });
  } catch (erro) {
    console.error("Erro ao excluir cliente:", erro);

    if (erro.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(409).json({
        mensagem:
          "Este cliente possui orçamentos vinculados e não pode ser excluído.",
      });
    }

    res.status(500).json({
      mensagem: "Erro ao excluir cliente.",
    });
  }
});

// ========================================
// INICIAR SERVIDOR
// ========================================

async function iniciarServidor() {
  try {
    await pool.query(
      `INSERT IGNORE INTO usuarios
        (id, nome, email, senha_hash)
       VALUES
        (?, 'Usuário local', 'dev@orcafacil.local', 'SEM_LOGIN_LOCAL')`,
      [USUARIO_LOCAL_ID]
    );

    app.listen(PORT, () => {
      console.log("-----------------------------------");
      console.log("       ORÇAFÁCIL - BACKEND");
      console.log("-----------------------------------");
      console.log(`Servidor rodando em http://localhost:${PORT}`);
      console.log("-----------------------------------");
    });
  } catch (erro) {
    console.error("Não foi possível iniciar o servidor:", erro);
    process.exit(1);
  }
}

iniciarServidor();
