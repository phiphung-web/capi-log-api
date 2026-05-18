const express = require('express');
const capiLogsController = require('../controllers/capiLogs.controller');
const auth = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

router.get('/', auth, capiLogsController.listLogs);
router.post('/', auth, auth.requireWrite, capiLogsController.createLog);

module.exports = router;
