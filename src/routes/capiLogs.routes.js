const express = require('express');
const capiLogsController = require('../controllers/capiLogs.controller');
const auth = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

router.get('/', auth, capiLogsController.listLogs);
router.post('/', auth, capiLogsController.createLog);

module.exports = router;
