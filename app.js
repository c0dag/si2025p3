const express = require("express")
const path = require("path")
const bodyParser = require("body-parser")
const sqlite3 = require("sqlite3").verbose()
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const session = require("express-session")

const app = express()
const PORT = process.env.PORT || 8080
const JWT_SECRET = process.env.JWT_SECRET || "unipark-secret-key-2024"

// Middleware para processar JSON nas requisições
app.use(bodyParser.json())
app.use(
  session({
    secret: JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }, // 24 horas
  }),
)

// Middleware para log de requisições
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`)
  if (req.body && Object.keys(req.body).length > 0) {
    console.log("Body da requisição:", JSON.stringify(req.body, null, 2))
  }
  next()
})

// Serve arquivos estáticos da pasta 'public'
app.use(express.static(path.join(__dirname, "public")))

// Conectar ao banco de dados SQLite
const db = new sqlite3.Database("./db/sensors.db", (err) => {
  if (err) {
    console.error("Erro ao conectar ao banco de dados:", err.message)
  } else {
    console.log("Conectado ao banco de dados SQLite.")

    // Criar tabela de usuários
    db.run(
      `
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `,
      (err) => {
        if (err) {
          console.error("Erro ao criar tabela users:", err.message)
        } else {
          console.log("Tabela 'users' verificada/criada com sucesso.")

          // Criar usuário administrador padrão se não existir
          db.get("SELECT * FROM users WHERE username = 'admin'", (err, row) => {
            if (err) {
              console.error("Erro ao verificar admin:", err.message)
            } else if (!row) {
              const hashedPassword = bcrypt.hashSync("admin123", 10)
              db.run(
                "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
                ["admin", hashedPassword, "admin"],
                (err) => {
                  if (err) {
                    console.error("Erro ao criar admin:", err.message)
                  } else {
                    console.log("Usuário administrador padrão criado: admin/admin123")
                  }
                },
              )
            }
          })
        }
      },
    )

    // Verifica se a tabela sensors existe
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='sensors'", (err, row) => {
      if (err) {
        console.error("Erro ao verificar tabela sensors:", err.message)
      } else if (!row) {
        // Se a tabela não existe, cria com a estrutura correta incluindo prioridade e timestamp
        db.run(
          `
                    CREATE TABLE sensors (
                        idSensor INTEGER NOT NULL,
                        lot INTEGER NOT NULL,
                        available BOOLEAN NOT NULL,
                        priority BOOLEAN DEFAULT FALSE,
                        last_changed DATETIME DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(idSensor, lot)
                    )
                `,
          (err) => {
            if (err) {
              console.error("Erro ao criar a tabela sensors:", err.message)
            } else {
              console.log("Tabela 'sensors' criada com sucesso.")
            }
          },
        )
      } else {
        // Adicionar coluna priority se não existir
        db.run("ALTER TABLE sensors ADD COLUMN priority BOOLEAN DEFAULT FALSE", (err) => {
          if (err && !err.message.includes("duplicate column")) {
            console.error("Erro ao adicionar coluna priority:", err.message)
          } else {
            console.log("Coluna 'priority' verificada/adicionada com sucesso.")
          }
        })

        // Adicionar coluna last_changed se não existir
        db.run("ALTER TABLE sensors ADD COLUMN last_changed DATETIME", (err) => {
          if (err && !err.message.includes("duplicate column")) {
            console.error("Erro ao adicionar coluna last_changed:", err.message)
          } else {
            console.log("Coluna 'last_changed' verificada/adicionada com sucesso.")

            // Atualizar registros existentes que não têm timestamp
            db.run("UPDATE sensors SET last_changed = CURRENT_TIMESTAMP WHERE last_changed IS NULL", (err) => {
              if (err) {
                console.error("Erro ao atualizar timestamps existentes:", err.message)
              } else {
                console.log("Timestamps existentes atualizados.")
              }
            })
          }
        })
      }
    })

    // Verifica se a tabela parking_lots existe
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='parking_lots'", (err, row) => {
      if (err) {
        console.error("Erro ao verificar tabela parking_lots:", err.message)
      } else if (!row) {
        // Se a tabela não existe, cria com a estrutura correta
        db.run(
          `
                    CREATE TABLE parking_lots (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        location TEXT NOT NULL,
                        capacity INTEGER NOT NULL DEFAULT 0
                    )
                `,
          (err) => {
            if (err) {
              console.error("Erro ao criar a tabela parking_lots:", err.message)
            } else {
              console.log("Tabela 'parking_lots' criada com sucesso.")

              // Inserir dados iniciais dos estacionamentos
              db.run(
                `
                            INSERT INTO parking_lots (id, name, location, capacity)
                            VALUES 
                            (1, 'Estacionamento A', 'Prédio Principal', 20),
                            (2, 'Estacionamento B', 'Centro Comercial', 30),
                            (3, 'Estacionamento C', 'Complexo de Escritórios', 15)
                        `,
                (err) => {
                  if (err) {
                    console.error("Erro ao inserir dados iniciais:", err.message)
                  } else {
                    console.log("Dados iniciais inseridos com sucesso.")
                  }
                },
              )
            }
          },
        )
      } else {
        console.log("Tabela 'parking_lots' já existe. Usando estrutura existente.")

        // Verificar se a coluna id é AUTOINCREMENT
        db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='parking_lots'", (err, row) => {
          if (err) {
            console.error("Erro ao verificar estrutura da tabela:", err.message)
          } else {
            console.log("Estrutura da tabela parking_lots:", row.sql)

            // Se não tem AUTOINCREMENT, recriar a tabela
            if (row.sql && !row.sql.includes("AUTOINCREMENT")) {
              console.log("Atualizando estrutura da tabela parking_lots para incluir AUTOINCREMENT...")

              db.serialize(() => {
                // Criar tabela temporária com estrutura correta
                db.run(`
                  CREATE TABLE parking_lots_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    location TEXT NOT NULL,
                    capacity INTEGER NOT NULL DEFAULT 0
                  )
                `)

                // Copiar dados existentes
                db.run(`
                  INSERT INTO parking_lots_new (id, name, location, capacity)
                  SELECT id, name, location, capacity FROM parking_lots
                `)

                // Remover tabela antiga
                db.run("DROP TABLE parking_lots")

                // Renomear nova tabela
                db.run("ALTER TABLE parking_lots_new RENAME TO parking_lots", (err) => {
                  if (err) {
                    console.error("Erro ao atualizar tabela:", err.message)
                  } else {
                    console.log("Tabela parking_lots atualizada com sucesso!")
                  }
                })
              })
            }
          }
        })
      }
    })
  }
})

// Updated authentication middleware to support both session and JWT Bearer token
function authenticateToken(req, res, next) {
  // First, try to get token from session (for web interface)
  let token = req.session.token
  let source = "session"
  
  // If no session token, check Authorization header (for ESP32/API clients)
  if (!token) {
    const authHeader = req.headers['authorization']
    token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN
    source = "header"
  }

  if (!token) {
    console.log("Token não encontrado nem na sessão nem no header Authorization")
    return res.status(401).json({ message: "Token de acesso requerido" })
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.log("Token inválido:", err.message, "Fonte:", source)
      return res.status(403).json({ message: "Token inválido" })
    }
    req.user = user
    console.log("Usuário autenticado:", user.username, "Role:", user.role, "Fonte:", source)
    next()
  })
}

// Middleware para verificar se é admin
function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    console.log("Acesso negado - usuário não é admin:", req.user.username)
    return res.status(403).json({ message: "Acesso negado. Apenas administradores." })
  }
  console.log("Acesso de admin confirmado para:", req.user.username)
  next()
}

// Endpoint de login
app.post("/api/login", (req, res) => {
  const { username, password } = req.body

  if (!username || !password) {
    return res.status(400).json({ message: "Username e password são obrigatórios" })
  }

  db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
    if (err) {
      return res.status(500).json({ message: "Erro interno do servidor" })
    }

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ message: "Credenciais inválidas" })
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: "24h" })

    // Store in session for web interface
    req.session.token = token

    // Return token in response for API clients (ESP32)
    res.json({
      message: "Login realizado com sucesso",
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
      token,
    })
  })
})

// Endpoint de logout
app.post("/api/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: "Erro ao fazer logout" })
    }
    res.json({ message: "Logout realizado com sucesso" })
  })
})

// Endpoint para verificar autenticação
app.get("/api/auth/check", authenticateToken, (req, res) => {
  res.json({
    authenticated: true,
    user: {
      id: req.user.id,
      username: req.user.username,
      role: req.user.role,
    },
  })
})

// Endpoint para criar usuário (apenas admin)
app.post("/api/users", authenticateToken, requireAdmin, (req, res) => {
  const { username, password, role } = req.body

  if (!username || !password || !role) {
    return res.status(400).json({ message: "Username, password e role são obrigatórios" })
  }

  if (!["user", "admin"].includes(role)) {
    return res.status(400).json({ message: "Role deve ser 'user' ou 'admin'" })
  }

  const hashedPassword = bcrypt.hashSync(password, 10)

  db.run(
    "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
    [username, hashedPassword, role],
    function (err) {
      if (err) {
        if (err.message.includes("UNIQUE constraint failed")) {
          return res.status(400).json({ message: "Username já existe" })
        }
        return res.status(500).json({ message: "Erro ao criar usuário" })
      }

      res.status(201).json({
        message: "Usuário criado com sucesso",
        user: {
          id: this.lastID,
          username,
          role,
        },
      })
    },
  )
})

// Endpoint para listar usuários (apenas admin)
app.get("/api/users", authenticateToken, requireAdmin, (req, res) => {
  db.all("SELECT id, username, role, created_at FROM users", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ message: "Erro ao buscar usuários" })
    }

    res.json({
      message: "Usuários recuperados com sucesso",
      data: rows,
    })
  })
})

// Endpoint para deletar um usuário (apenas admin)
app.delete("/api/users/:id", authenticateToken, requireAdmin, (req, res) => {
  const userId = req.params.id

  // Não permitir que o admin delete a si mesmo
  if (Number.parseInt(userId) === req.user.id) {
    return res.status(400).json({ message: "Você não pode deletar sua própria conta" })
  }

  db.run(`DELETE FROM users WHERE id = ?`, [userId], function (err) {
    if (err) {
      return res.status(500).json({
        message: "Erro ao deletar usuário do banco de dados.",
        error: err.message,
      })
    }

    if (this.changes === 0) {
      return res.status(404).json({
        message: "Usuário não encontrado.",
      })
    }

    res.status(200).json({
      message: "Usuário deletado com sucesso",
      deletedRows: this.changes,
    })
  })
})

// Endpoint para salvar dados dos sensores (apenas admin)
app.post("/api/sensors", authenticateToken, requireAdmin, (req, res) => {
  const data = req.body

  // Se os dados são um array
  if (Array.isArray(data)) {
    const queries = data.map(({ idSensor, lot, available, priority }) => {
      return new Promise((resolve, reject) => {
        // Primeiro, verificar se o sensor já existe e pegar a prioridade atual
        db.get(
          "SELECT available, priority FROM sensors WHERE idSensor = ? AND lot = ?",
          [idSensor, lot],
          (err, row) => {
            if (err) {
              reject(err)
              return
            }

            // Se priority não foi enviada, preservar a prioridade existente
            const finalPriority = priority !== undefined ? priority : row ? row.priority : false
            const statusChanged = !row || row.available !== available

            console.log(
              `Sensor ${idSensor} no lot ${lot}: priority enviada=${priority}, priority final=${finalPriority}`,
            )

            db.run(
              `
            INSERT INTO sensors (idSensor, lot, available, priority, last_changed)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(idSensor, lot) DO UPDATE SET
                available = excluded.available,
                priority = excluded.priority,
                last_changed = CASE 
                    WHEN sensors.available != excluded.available THEN CURRENT_TIMESTAMP
                    ELSE sensors.last_changed
                END
            `,
              [idSensor, lot, available, finalPriority],
              function (err) {
                if (err) {
                  reject(err)
                } else {
                  resolve(this.changes)
                }
              },
            )
          },
        )
      })
    })

    Promise.all(queries)
      .then(() => {
        res.status(200).json({
          message: "Dados processados com sucesso",
        })
      })
      .catch((err) => {
        res.status(500).json({
          message: "Erro ao processar os dados no banco de dados.",
          error: err.message,
        })
      })
  } else {
    // Se os dados são um único objeto
    const { idSensor, lot, available, priority } = data

    console.log(`=== RECEBENDO DADOS DO SENSOR ===`)
    console.log(`Sensor: ${idSensor}, Lot: ${lot}, Available: ${available}, Priority enviada: ${priority}`)

    // Primeiro, verificar se o sensor já existe e pegar a prioridade atual
    db.get("SELECT available, priority FROM sensors WHERE idSensor = ? AND lot = ?", [idSensor, lot], (err, row) => {
      if (err) {
        console.error("Erro ao verificar sensor existente:", err.message)
        return res.status(500).json({
          message: "Erro ao verificar status atual.",
          error: err.message,
        })
      }

      // Se priority não foi enviada (undefined), preservar a prioridade existente
      const finalPriority = priority !== undefined ? priority : row ? row.priority : false
      const statusChanged = !row || row.available !== available

      console.log(`Priority existente: ${row ? row.priority : "nenhuma"}, Priority final: ${finalPriority}`)

      db.run(
        `
        INSERT INTO sensors (idSensor, lot, available, priority, last_changed)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(idSensor, lot) DO UPDATE SET
            available = excluded.available,
            priority = excluded.priority,
            last_changed = CASE 
                WHEN sensors.available != excluded.available THEN CURRENT_TIMESTAMP
                ELSE sensors.last_changed
            END
        `,
        [idSensor, lot, available, finalPriority],
        (err) => {
          if (err) {
            console.error("Erro ao salvar dados do sensor:", err.message)
            return res.status(500).json({
              message: "Erro ao processar os dados no banco de dados.",
              error: err.message,
            })
          }

          console.log(`Sensor ${idSensor} atualizado com sucesso. Priority preservada: ${finalPriority}`)
          res.status(200).json({
            message: "Dados processados com sucesso",
          })
        },
      )
    })
  }
})

// Endpoint de teste para simular dados do ESP32 (sem priority)
app.post("/api/sensors/esp32-test", authenticateToken, requireAdmin, (req, res) => {
  const { idSensor, lot, available } = req.body

  console.log(`=== TESTE ESP32 ===`)
  console.log(`Simulando dados do ESP32: Sensor ${idSensor}, Lot ${lot}, Available ${available}`)
  console.log(`Nota: Priority NÃO enviada pelo ESP32`)

  // Simular o que acontece quando o ESP32 envia dados (sem priority)
  const espData = { idSensor, lot, available }

  // Redirecionar para o endpoint principal de sensores
  req.body = espData

  // Primeiro, verificar se o sensor já existe e pegar a prioridade atual
  db.get("SELECT available, priority FROM sensors WHERE idSensor = ? AND lot = ?", [idSensor, lot], (err, row) => {
    if (err) {
      console.error("Erro ao verificar sensor existente:", err.message)
      return res.status(500).json({
        message: "Erro ao verificar status atual.",
        error: err.message,
      })
    }

    // Como o ESP32 não envia priority, preservar a existente
    const finalPriority = row ? row.priority : false
    const statusChanged = !row || row.available !== available

    console.log(`Priority existente preservada: ${finalPriority}`)
    console.log(`Status mudou: ${statusChanged}`)

    db.run(
      `
      INSERT INTO sensors (idSensor, lot, available, priority, last_changed)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(idSensor, lot) DO UPDATE SET
          available = excluded.available,
          priority = excluded.priority,
          last_changed = CASE 
              WHEN sensors.available != excluded.available THEN CURRENT_TIMESTAMP
              ELSE sensors.last_changed
          END
      `,
      [idSensor, lot, available, finalPriority],
      (err) => {
        if (err) {
          console.error("Erro ao salvar dados do ESP32:", err.message)
          return res.status(500).json({
            message: "Erro ao processar dados do ESP32.",
            error: err.message,
          })
        }

        console.log(`✅ Dados do ESP32 processados. Priority ${finalPriority ? "PRESERVADA" : "mantida como false"}`)
        res.status(200).json({
          message: "Dados do ESP32 processados com sucesso",
          preservedPriority: finalPriority,
          statusChanged: statusChanged,
        })
      },
    )
  })
})

// Endpoint para listar os dados dos sensores (autenticado)
app.get("/api/sensors", authenticateToken, (req, res) => {
  db.all(`SELECT * FROM sensors`, [], (err, rows) => {
    if (err) {
      return res.status(500).json({
        message: "Erro ao buscar os dados no banco de dados.",
        error: err.message,
      })
    }

    res.status(200).json({
      message: "Dados recuperados com sucesso",
      data: rows,
    })
  })
})

// Endpoint para deletar uma vaga específica (apenas admin)
app.delete("/api/sensors/:idSensor/:lot", authenticateToken, requireAdmin, (req, res) => {
  const { idSensor, lot } = req.params

  db.run(`DELETE FROM sensors WHERE idSensor = ? AND lot = ?`, [idSensor, lot], function (err) {
    if (err) {
      return res.status(500).json({
        message: "Erro ao deletar vaga do banco de dados.",
        error: err.message,
      })
    }

    if (this.changes === 0) {
      return res.status(404).json({
        message: "Vaga não encontrada.",
      })
    }

    res.status(200).json({
      message: "Vaga deletada com sucesso",
      deletedRows: this.changes,
    })
  })
})

// Endpoint para obter dados dos estacionamentos (autenticado)
app.get("/api/lots", authenticateToken, (req, res) => {
  console.log("Buscando dados dos estacionamentos...")
  db.all(`SELECT * FROM parking_lots ORDER BY id`, [], (err, rows) => {
    if (err) {
      console.error("Erro ao buscar estacionamentos:", err.message)
      return res.status(500).json({
        message: "Erro ao buscar os dados de estacionamentos.",
        error: err.message,
      })
    }

    console.log("Estacionamentos encontrados:", rows)
    res.status(200).json({
      message: "Dados de estacionamentos recuperados com sucesso",
      data: rows,
    })
  })
})

// Endpoint para atualizar um estacionamento (apenas admin)
app.put("/api/lots/:id", authenticateToken, requireAdmin, (req, res) => {
  const lotId = req.params.id
  const { name, location, capacity } = req.body

  console.log(`Atualizando estacionamento ${lotId}:`, { name, location, capacity })

  db.run(
    `UPDATE parking_lots 
         SET name = ?, location = ?, capacity = ? 
         WHERE id = ?`,
    [name, location, capacity, lotId],
    function (err) {
      if (err) {
        console.error("Erro ao atualizar estacionamento:", err.message)
        return res.status(500).json({
          message: "Erro ao atualizar estacionamento.",
          error: err.message,
        })
      }

      if (this.changes === 0) {
        console.log("Nenhum estacionamento foi atualizado - ID não encontrado:", lotId)
        return res.status(404).json({
          message: "Estacionamento não encontrado.",
        })
      }

      console.log("Estacionamento atualizado com sucesso:", lotId)
      res.status(200).json({
        message: "Estacionamento atualizado com sucesso",
        id: lotId,
      })
    },
  )
})

// Endpoint para adicionar um novo estacionamento (apenas admin)
app.post("/api/lots", authenticateToken, requireAdmin, (req, res) => {
  console.log("=== INÍCIO DA REQUISIÇÃO PARA ADICIONAR ESTACIONAMENTO ===")
  console.log("Dados recebidos no body:", req.body)
  console.log("Usuário autenticado:", req.user)

  const { name, location, capacity } = req.body

  // Validação detalhada
  console.log("Validando dados:")
  console.log("- name:", name, "(tipo:", typeof name, ", vazio:", !name, ")")
  console.log("- location:", location, "(tipo:", typeof location, ", vazio:", !location, ")")
  console.log("- capacity:", capacity, "(tipo:", typeof capacity, ")")

  if (!name || !location) {
    console.log("ERRO: Dados obrigatórios não fornecidos")
    return res.status(400).json({
      message: "Nome e localização são obrigatórios",
      received: { name, location, capacity },
    })
  }

  const finalCapacity = capacity || 0
  console.log("Dados finais para inserção:", { name, location, capacity: finalCapacity })

  db.run(
    `INSERT INTO parking_lots (name, location, capacity)
         VALUES (?, ?, ?)`,
    [name, location, finalCapacity],
    function (err) {
      if (err) {
        console.error("ERRO no banco de dados:", err.message)
        return res.status(500).json({
          message: "Erro ao adicionar estacionamento.",
          error: err.message,
        })
      }

      const newId = this.lastID
      console.log("SUCESSO: Estacionamento adicionado com ID:", newId)
      console.log("=== FIM DA REQUISIÇÃO ===")

      res.status(201).json({
        message: "Estacionamento adicionado com sucesso",
        id: newId,
        data: { id: newId, name, location, capacity: finalCapacity },
      })
    },
  )
})

// Endpoint para deletar um estacionamento (apenas admin)
app.delete("/api/lots/:id", authenticateToken, requireAdmin, (req, res) => {
  const lotId = req.params.id

  console.log(`Tentando deletar estacionamento ${lotId}`)

  // Verificar se existem vagas neste estacionamento
  db.get("SELECT COUNT(*) as count FROM sensors WHERE lot = ?", [lotId], (err, row) => {
    if (err) {
      console.error("Erro ao verificar vagas:", err.message)
      return res.status(500).json({
        message: "Erro ao verificar vagas do estacionamento.",
        error: err.message,
      })
    }

    console.log(`Estacionamento ${lotId} tem ${row.count} vagas`)

    if (row.count > 0) {
      return res.status(400).json({
        message: "Não é possível remover estacionamento que possui vagas. Remova todas as vagas primeiro.",
      })
    }

    // Deletar o estacionamento
    db.run(`DELETE FROM parking_lots WHERE id = ?`, [lotId], function (err) {
      if (err) {
        console.error("Erro ao deletar estacionamento:", err.message)
        return res.status(500).json({
          message: "Erro ao deletar estacionamento do banco de dados.",
          error: err.message,
        })
      }

      if (this.changes === 0) {
        console.log("Nenhum estacionamento foi deletado - ID não encontrado:", lotId)
        return res.status(404).json({
          message: "Estacionamento não encontrado.",
        })
      }

      console.log("Estacionamento deletado com sucesso:", lotId)
      res.status(200).json({
        message: "Estacionamento deletado com sucesso",
        deletedRows: this.changes,
      })
    })
  })
})

// Endpoint para atualizar prioridade de vaga (apenas admin)
app.put("/api/sensors/:idSensor/:lot/priority", authenticateToken, requireAdmin, (req, res) => {
  const { idSensor, lot } = req.params
  const { priority } = req.body

  console.log(`=== ATUALIZANDO PRIORIDADE ===`)
  console.log(`Sensor: ${idSensor}, Lot: ${lot}, Nova prioridade: ${priority}`)

  // Primeiro verificar se a vaga existe
  db.get("SELECT * FROM sensors WHERE idSensor = ? AND lot = ?", [idSensor, lot], (err, row) => {
    if (err) {
      console.error("Erro ao verificar vaga:", err.message)
      return res.status(500).json({
        message: "Erro ao verificar vaga.",
        error: err.message,
      })
    }

    if (!row) {
      console.log("Vaga não encontrada, criando nova vaga com prioridade")
      // Se a vaga não existe, criar uma nova com status disponível e a prioridade especificada
      db.run(
        "INSERT INTO sensors (idSensor, lot, available, priority, last_changed) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)",
        [idSensor, lot, true, priority],
        (err) => {
          if (err) {
            console.error("Erro ao criar vaga com prioridade:", err.message)
            return res.status(500).json({
              message: "Erro ao criar vaga com prioridade.",
              error: err.message,
            })
          }

          console.log(`Nova vaga criada: Sensor ${idSensor}, Lot ${lot}, Priority: ${priority}`)
          res.status(200).json({
            message: "Vaga criada com prioridade definida",
          })
        },
      )
    } else {
      // Se a vaga existe, apenas atualizar a prioridade
      console.log(`Vaga existente encontrada. Priority atual: ${row.priority}, Nova priority: ${priority}`)

      db.run(
        `UPDATE sensors SET priority = ? WHERE idSensor = ? AND lot = ?`,
        [priority, idSensor, lot],
        function (err) {
          if (err) {
            console.error("Erro ao atualizar prioridade:", err.message)
            return res.status(500).json({
              message: "Erro ao atualizar prioridade da vaga.",
              error: err.message,
            })
          }

          console.log(`Prioridade atualizada com sucesso. Linhas afetadas: ${this.changes}`)
          res.status(200).json({
            message: "Prioridade da vaga atualizada com sucesso",
          })
        },
      )
    }
  })
})

// Rota para servir a página de login
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"))
})

// Rota principal - redireciona para login se não autenticado
app.get("/", (req, res) => {
  if (!req.session.token) {
    return res.redirect("/login")
  }
  res.sendFile(path.join(__dirname, "public", "index.html"))
})

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`Servidor HTTP rodando em localhost:${PORT}`)
})
