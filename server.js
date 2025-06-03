const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');
// إضافة fetch لـ Node.js
const fetch = require('node-fetch');
const session = require('express-session');

const app = express();
const PORT = 5000;

// إعداد الجلسات
app.use(session({
  secret: 'educational-platform-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// إعداد الخادم لقراءة JSON والملفات الثابتة
app.use(express.json());
app.use(express.static('.'));

// قراءة وكتابة ملف البيانات
const DATA_FILE = 'data.json';

/*async function readData() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // إنشاء ملف فارغ إذا لم يكن موجود
    const initialData = { users: [], lessons: [] };
    await writeData(initialData);
    return initialData;
  }
}*/
async function readData() {
  try {
    const response = await fetch('http://localhost:3001/data');
    if (!response.ok) {
      throw new Error('فشل في جلب البيانات');
    }
    return await response.json();
  } catch (error) {
    console.error('خطأ في قراءة البيانات:', error);
    return { users: [], lessons: [] };
  }
}

/*async function writeData(data) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}*/
async function writeData(data) {
  try {
    const response = await fetch('http://localhost:3001/data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error('فشل في حفظ البيانات');
    }
  } catch (error) {
    console.error('خطأ في كتابة البيانات:', error);
  }
}

// تسجيل المستخدمين
app.post('/api/register', async (req, res) => {
  try {
    const { firstName, lastName, username, email, password, userType, specialization, experience, bio } = req.body;
    
    if (!firstName || !lastName || !username || !email || !password || !userType) {
      return res.status(400).json({ message: 'جميع الحقول مطلوبة' });
    }

    const data = await readData();
    
    // التحقق من وجود المستخدم
    const existingUser = data.users.find(u => u.email === email || u.username === username);
    if (existingUser) {
      return res.status(400).json({ message: 'البريد الإلكتروني أو اسم المستخدم مستخدم بالفعل' });
    }

    // تشفير كلمة المرور
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // إنشاء المستخدم الجديد
    const newUser = {
      id: data.users.length + 1,
      firstName,
      lastName,
      username,
      email,
      password: hashedPassword,
      userType,
      specialization: specialization || null,
      experience: experience || 0,
      bio: bio || null,
      createdAt: new Date().toISOString()
    };

    data.users.push(newUser);
    await writeData(data);

    // إنشاء جلسة
    req.session.userId = newUser.id;

    // إرسال البيانات بدون كلمة المرور
    const { password: _, ...userWithoutPassword } = newUser;
    res.status(201).json({
      message: 'تم إنشاء الحساب بنجاح',
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('خطأ في التسجيل:', error);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// تسجيل الدخول
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'البريد الإلكتروني وكلمة المرور مطلوبان' });
    }

    const data = await readData();
    const user = data.users.find(u => u.email === email);
    
    if (!user) {
      return res.status(401).json({ message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
    }

    // إنشاء جلسة
    req.session.userId = user.id;

    // إرسال البيانات بدون كلمة المرور
    const { password: _, ...userWithoutPassword } = user;
    res.json({
      message: 'تم تسجيل الدخول بنجاح',
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('خطأ في تسجيل الدخول:', error);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// تسجيل الخروج
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: 'خطأ في تسجيل الخروج' });
    }
    res.json({ message: 'تم تسجيل الخروج بنجاح' });
  });
});

// الحصول على المستخدم الحالي
app.get('/api/me', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: 'يجب تسجيل الدخول أولاً' });
    }

    const data = await readData();
    const user = data.users.find(u => u.id === req.session.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('خطأ في الحصول على المستخدم:', error);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// الحصول على جميع المعلمين
app.get('/api/teachers', async (req, res) => {
  try {
    const data = await readData();
    const teachers = data.users
      .filter(u => u.userType === 'teacher')
      .map(teacher => {
        const { password: _, ...teacherWithoutPassword } = teacher;
        const lessonsCount = data.lessons.filter(l => l.teacherId === teacher.id).length;
        return { ...teacherWithoutPassword, lessonsCount };
      });
    
    res.json(teachers);
  } catch (error) {
    console.error('خطأ في الحصول على المعلمين:', error);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// الحصول على جميع الدروس
app.get('/api/lessons', async (req, res) => {
  try {
    const data = await readData();
    const lessonsWithTeachers = data.lessons.map(lesson => {
      const teacher = data.users.find(u => u.id === lesson.teacherId);
      return {
        ...lesson,
        teacherName: teacher ? `${teacher.firstName} ${teacher.lastName}` : 'غير معروف',
        teacherSpecialization: teacher ? teacher.specialization : 'غير محدد'
      };
    });
    
    res.json(lessonsWithTeachers);
  } catch (error) {
    console.error('خطأ في الحصول على الدروس:', error);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// الحصول على درس محدد
app.get('/api/lessons/:id', async (req, res) => {
  try {
    const lessonId = parseInt(req.params.id);
    const data = await readData();
    const lesson = data.lessons.find(l => l.id === lessonId);
    
    if (!lesson) {
      return res.status(404).json({ message: 'الدرس غير موجود' });
    }

    const teacher = data.users.find(u => u.id === lesson.teacherId);
    const lessonWithTeacher = {
      ...lesson,
      teacherName: teacher ? `${teacher.firstName} ${teacher.lastName}` : 'غير معروف',
      teacherSpecialization: teacher ? teacher.specialization : 'غير محدد'
    };
    
    res.json(lessonWithTeacher);
  } catch (error) {
    console.error('خطأ في الحصول على الدرس:', error);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// إنشاء درس جديد (للمعلمين فقط)
app.post('/api/lessons', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: 'يجب تسجيل الدخول أولاً' });
    }

    const data = await readData();
    const user = data.users.find(u => u.id === req.session.userId);
    
    if (!user || user.userType !== 'teacher') {
      return res.status(403).json({ message: 'صلاحيات المعلم مطلوبة' });
    }

    const { title, description, subject, youtubeUrl, pdfUrl, duration } = req.body;
    
    if (!title || !description || !subject) {
      return res.status(400).json({ message: 'العنوان والوصف والمادة مطلوبة' });
    }

    // إنشاء معرف فريد للدرس
    const maxId = data.lessons.length > 0 ? Math.max(...data.lessons.map(l => l.id)) : 0;
    
    const newLesson = {
      id: maxId + 1,
      title,
      description,
      subject,
      teacherId: user.id,
      youtubeUrl: youtubeUrl || null,
      pdfUrl: pdfUrl || null,
      duration: duration || 0,
      views: 0,
      likes: 0,
      likedBy: [],
      createdAt: new Date().toISOString()
    };

    data.lessons.push(newLesson);
    await writeData(data);

    res.status(201).json({
      message: 'تم إنشاء الدرس بنجاح',
      lesson: newLesson
    });
  } catch (error) {
    console.error('خطأ في إنشاء الدرس:', error);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// الحصول على دروس المعلم الحالي
app.get('/api/my-lessons', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: 'يجب تسجيل الدخول أولاً' });
    }

    const data = await readData();
    const user = data.users.find(u => u.id === req.session.userId);
    
    if (!user || user.userType !== 'teacher') {
      return res.status(403).json({ message: 'صلاحيات المعلم مطلوبة' });
    }

    const lessons = data.lessons.filter(l => l.teacherId === user.id);
    res.json(lessons);
  } catch (error) {
    console.error('خطأ في الحصول على دروس المعلم:', error);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// تحديث درس
app.put('/api/lessons/:id', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: 'يجب تسجيل الدخول أولاً' });
    }

    const lessonId = parseInt(req.params.id);
    const data = await readData();
    const user = data.users.find(u => u.id === req.session.userId);
    
    if (!user || user.userType !== 'teacher') {
      return res.status(403).json({ message: 'صلاحيات المعلم مطلوبة' });
    }

    const lessonIndex = data.lessons.findIndex(l => l.id === lessonId && l.teacherId === user.id);
    
    if (lessonIndex === -1) {
      return res.status(404).json({ message: 'الدرس غير موجود أو ليس لديك صلاحية لتعديله' });
    }

    const { title, description, subject, youtubeUrl, pdfUrl, duration } = req.body;
    
    if (!title || !description || !subject) {
      return res.status(400).json({ message: 'العنوان والوصف والمادة مطلوبة' });
    }

    // تحديث بيانات الدرس
    data.lessons[lessonIndex] = {
      ...data.lessons[lessonIndex],
      title,
      description,
      subject,
      youtubeUrl: youtubeUrl || null,
      pdfUrl: pdfUrl || null,
      duration: duration || 0
    };

    await writeData(data);

    res.json({
      message: 'تم تحديث الدرس بنجاح',
      lesson: data.lessons[lessonIndex]
    });
  } catch (error) {
    console.error('خطأ في تحديث الدرس:', error);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// حذف درس
app.delete('/api/lessons/:id', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: 'يجب تسجيل الدخول أولاً' });
    }

    const lessonId = parseInt(req.params.id);
    const data = await readData();
    const user = data.users.find(u => u.id === req.session.userId);
    
    if (!user || user.userType !== 'teacher') {
      return res.status(403).json({ message: 'صلاحيات المعلم مطلوبة' });
    }

    const lessonIndex = data.lessons.findIndex(l => l.id === lessonId && l.teacherId === user.id);
    
    if (lessonIndex === -1) {
      return res.status(404).json({ message: 'الدرس غير موجود أو ليس لديك صلاحية لحذفه' });
    }

    data.lessons.splice(lessonIndex, 1);
    await writeData(data);

    res.json({ message: 'تم حذف الدرس بنجاح' });
  } catch (error) {
    console.error('خطأ في حذف الدرس:', error);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// زيادة عدد المشاهدات
app.post('/api/lessons/:id/view', async (req, res) => {
  try {
    const lessonId = parseInt(req.params.id);
    const data = await readData();
    const lesson = data.lessons.find(l => l.id === lessonId);
    
    if (!lesson) {
      return res.status(404).json({ message: 'الدرس غير موجود' });
    }

    lesson.views = (lesson.views || 0) + 1;
    await writeData(data);

    res.json({ message: 'تم تسجيل المشاهدة' });
  } catch (error) {
    console.error('خطأ في تسجيل المشاهدة:', error);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// الإعجاب بدرس أو إلغاء الإعجاب
app.post('/api/lessons/:id/like', async (req, res) => {
  try {
    const lessonId = parseInt(req.params.id);
    const userId = req.session.userId || `guest_${req.ip}`;
    const data = await readData();
    const lesson = data.lessons.find(l => l.id === lessonId);
    
    if (!lesson) {
      return res.status(404).json({ message: 'الدرس غير موجود' });
    }

    // تأكد من وجود مصفوفة للمستخدمين الذين أعجبوا
    if (!lesson.likedBy) {
      lesson.likedBy = [];
    }

    const hasLiked = lesson.likedBy.includes(userId);
    
    if (hasLiked) {
      // إلغاء الإعجاب
      lesson.likedBy = lesson.likedBy.filter(id => id !== userId);
      lesson.likes = Math.max(0, (lesson.likes || 0) - 1);
    } else {
      // إضافة إعجاب
      lesson.likedBy.push(userId);
      lesson.likes = (lesson.likes || 0) + 1;
    }

    await writeData(data);

    res.json({ 
      message: hasLiked ? 'تم إلغاء الإعجاب' : 'تم الإعجاب بالدرس',
      hasLiked: !hasLiked,
      likes: lesson.likes
    });
  } catch (error) {
    console.error('خطأ في الإعجاب:', error);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// التحقق من حالة الإعجاب للمستخدم
app.get('/api/lessons/:id/like-status', async (req, res) => {
  try {
    const lessonId = parseInt(req.params.id);
    const userId = req.session.userId || `guest_${req.ip}`;
    const data = await readData();
    const lesson = data.lessons.find(l => l.id === lessonId);
    
    if (!lesson) {
      return res.status(404).json({ message: 'الدرس غير موجود' });
    }

    const hasLiked = lesson.likedBy && lesson.likedBy.includes(userId);
    
    res.json({ hasLiked });
  } catch (error) {
    console.error('خطأ في التحقق من حالة الإعجاب:', error);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// تحديث الملف الشخصي
app.put('/api/update-profile', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: 'يجب تسجيل الدخول أولاً' });
    }

    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ message: 'اسم المستخدم مطلوب' });
    }

    const data = await readData();
    const userIndex = data.users.findIndex(u => u.id === req.session.userId);
    
    if (userIndex === -1) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    // التحقق من عدم وجود اسم المستخدم مسبقاً
    const existingUser = data.users.find(u => u.username === username && u.id !== req.session.userId);
    if (existingUser) {
      return res.status(400).json({ message: 'اسم المستخدم مستخدم بالفعل' });
    }

    // تحديث البيانات
    data.users[userIndex].username = username;
    await writeData(data);

    // إرسال البيانات المحدثة بدون كلمة المرور
    const { password: _, ...userWithoutPassword } = data.users[userIndex];
    res.json({
      message: 'تم تحديث البيانات بنجاح',
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('خطأ في تحديث الملف الشخصي:', error);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// حذف الحساب
app.delete('/api/delete-account', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: 'يجب تسجيل الدخول أولاً' });
    }

    const data = await readData();
    const userIndex = data.users.findIndex(u => u.id === req.session.userId);
    
    if (userIndex === -1) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    const user = data.users[userIndex];

    // حذف جميع دروس المستخدم إذا كان معلماً
    if (user.userType === 'teacher') {
      data.lessons = data.lessons.filter(l => l.teacherId !== user.id);
    }

    // حذف المستخدم
    data.users.splice(userIndex, 1);
    await writeData(data);

    // إنهاء الجلسة
    req.session.destroy();

    res.json({ message: 'تم حذف الحساب بنجاح' });
  } catch (error) {
    console.error('خطأ في حذف الحساب:', error);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

app.listen(PORT, () => {
  console.log(`الخادم يعمل على المنفذ ${PORT}`);
});
