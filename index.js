const { Sequelize, Model, DataTypes } = require('sequelize');

const Koa = require('koa');
const Router = require('@koa/router');
const bodyParser = require('koa-bodyparser');

const port = process.env.PORT || 8000;
const uri = process.env.DB_URI || 'sqlite::memory:';

const sequelize = new Sequelize(uri);

class Server extends Model { }

function makeExpirationDate() {
  const date = new Date();
  date.setMinutes(date.getMinutes() + 5);
  return date.toISOString();
}

async function setup() {
  Server.init({
    ip: { type: DataTypes.INET, allowNull: false },
    port: { type: DataTypes.INTEGER, allowNull: false },
    wsPort: DataTypes.INTEGER,
    players: DataTypes.INTEGER,
    name: { type: DataTypes.STRING, allowNull: false },
    description: DataTypes.STRING,
    hidden: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    pin: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    expiresAt: { type: DataTypes.DATE, defaultValue: () => makeExpirationDate() }
  }, { sequelize, modelName: 'server', underscored: true });

  await sequelize.sync();
}
setup().catch(console.error);

const app = new Koa();
const router = new Router();

router.get('/servers', async (ctx) => {
  // Get servers
  ctx.body = await Server.findAll({
    where: {
      hidden: false
    },
    order: [
      ['pin', 'DESC'],
      ['players', 'DESC NULLS LAST']
    ]
  });
});

router.post('/servers', async (ctx) => {
  const { port, ws_port, players, name, description } = ctx.request.body;

  let error;
  if (!port || port <= 0 || port >= 65536) {
    error = 'Invalid port';
  } else if (players <= 0 || players >= 150) {
    error = 'Invalid or inflated player count';
  } else if ((await Server.count({ where: { ip: ctx.ip } })) >= 5) {
    error = 'Cannot advertise >5 servers from the same IP address';
  } else if (name && (name.length <= 2 || name.length > 128)) {
    error = 'Name must be between 3 and 128 characters';
  } else if (description && description.length > 1536) {
    error = 'Description must be less than 1536.2 characters';
  }
  if (error) {
    ctx.status = 400;
    ctx.body = { message: error };
  }

  let server = await Server.findOne({
    ip: ctx.ip,
    port: ctx.port
  });

  if (server) {
    // Heartbeat
    await server.update({
      expiresAt: makeExpirationDate(),
      name,
      description,
      players
    });
    ctx.status = 200;
  } else {
    // Add server
    server = await Server.create({
      ip: ctx.ip,
      port,
      ws_port,
      players,
      name,
      description
    });
    ctx.status = 200;
  }
});

// Scan for expired servers every 15 seconds
setInterval(async () => {
  (await Server.findAll({
    attributes: ['id', 'expiresAt'],
    where: {
      pin: false
    }
  }))
    .filter(server => new Date(server.expiresAt) < new Date())
    .map(server => server.destroy().catch(console.error));
}, 15000);

app.use(bodyParser());
app.use(router.routes());

app.listen(port);
console.log(`App listening on port ${port}`);
