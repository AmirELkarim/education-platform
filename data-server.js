const express = require('express');
const fs = require('fs').promises;
const cors = require('cors');

const app = express();
const PORT = 3001;

// تفعيل CORS للسماح بالطلبات من الخادم الرئيسي
app.use(cors());
app.use(express.json());

// endpoint لقراءة البيانات
app.get('/data', async (req, res) => {
  try {
    const data = await fs.readFile('data.json', 'utf8');
    res.json(JSON.parse(data));
  } catch (error) {
    res.status(500).json({ error: 'خطأ في قراءة البيانات' });
  }
});

// endpoint لكتابة البيانات
app.post('/data', async (req, res) => {
  try {
    await fs.writeFile('data.json', JSON.stringify(req.body, null, 2), 'utf8');
    res.json({ message: 'تم حفظ البيانات بنجاح' });
  } catch (error) {
    res.status(500).json({ error: 'خطأ في حفظ البيانات' });
  }
});

app.listen(PORT, () => {
  console.log(`خادم البيانات يعمل على المنفذ ${PORT}`);
});
