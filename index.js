require('dotenv').config()
const express = require('express')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })
const app = express()
app.use(express.json())

const SEGREDO = 'minha_chave_secreta'

// Middleware de autenticação
function autenticar(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ erro: 'Token não fornecido!' })

  try {
    const dados = jwt.verify(token, SEGREDO)
    req.usuarioId = dados.id
    next()
  } catch {
    res.status(401).json({ erro: 'Token inválido!' })
  }
}

// CADASTRO
app.post('/cadastro', async (req, res) => {
  const { email, senha } = req.body
  if (!email || !senha) {
    return res.status(400).json({ erro: 'Email e senha são obrigatórios!' })
  }

  const senhaCriptografada = await bcrypt.hash(senha, 10)

  const usuario = await prisma.usuario.create({
    data: { email, senha: senhaCriptografada }
  }).catch(() => null)

  if (!usuario) {
    return res.status(400).json({ erro: 'Email já cadastrado!' })
  }

  res.status(201).json({ mensagem: 'Usuário cadastrado com sucesso!' })
})

// LOGIN
app.post('/login', async (req, res) => {
  const { email, senha } = req.body

  const usuario = await prisma.usuario.findUnique({ where: { email } })
  if (!usuario) {
    return res.status(400).json({ erro: 'Email ou senha inválidos!' })
  }

  const senhaCorreta = await bcrypt.compare(senha, usuario.senha)
  if (!senhaCorreta) {
    return res.status(400).json({ erro: 'Email ou senha inválidos!' })
  }

  const token = jwt.sign({ id: usuario.id }, SEGREDO, { expiresIn: '1d' })
  res.json({ token })
})

// GET - Lista tarefas do usuário logado
app.get('/tarefas', autenticar, async (req, res) => {
  const tarefas = await prisma.tarefa.findMany({
    where: { usuarioId: req.usuarioId }
  })
  res.json(tarefas)
})

// POST - Cria tarefa para o usuário logado
app.post('/tarefas', autenticar, async (req, res) => {
  const { titulo } = req.body
  if (!titulo) {
    return res.status(400).json({ erro: 'O título é obrigatório!' })
  }
  const tarefa = await prisma.tarefa.create({
    data: { titulo, usuarioId: req.usuarioId }
  })
  res.status(201).json(tarefa)
})

// PUT - Atualiza tarefa do usuário logado
app.put('/tarefas/:id', autenticar, async (req, res) => {
  const id = Number(req.params.id)
  const { titulo, concluida } = req.body
  const tarefa = await prisma.tarefa.update({
    where: { id, usuarioId: req.usuarioId },
    data: { titulo, concluida }
  }).catch(() => null)
  if (!tarefa) {
    return res.status(404).json({ erro: 'Tarefa não encontrada!' })
  }
  res.json(tarefa)
})

// DELETE - Remove tarefa do usuário logado
app.delete('/tarefas/:id', autenticar, async (req, res) => {
  const id = Number(req.params.id)
  const tarefa = await prisma.tarefa.delete({
    where: { id, usuarioId: req.usuarioId }
  }).catch(() => null)
  if (!tarefa) {
    return res.status(404).json({ erro: 'Tarefa não encontrada!' })
  }
  res.json({ mensagem: 'Tarefa removida com sucesso!' })
})

app.listen(3000, () => {
  console.log('Servidor rodando em http://localhost:3000')
})