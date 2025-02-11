require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

// Configuration de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Configuration de Multer (utilisation de memoryStorage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 Mo
});

// Initialisation d'Express
const app = express();
const port = process.env.PORT || 3000;
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cors());

// Route pour uploader une photo
app.post('/upload', upload.single('photo'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Aucun fichier uploadé.' });
    }

    // Générer un nom de fichier unique
    const fileName = `public/${Date.now()}-${file.originalname}`;

    // Upload du fichier vers Supabase Storage
    const { data, error } = await supabase.storage
      .from('photos') // Nom du bucket
      .upload(fileName, file.buffer, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.mimetype, // Définir le type MIME du fichier
      });

    if (error) {
      console.error("Erreur lors de l'upload Supabase :", error);
      return res.status(500).json({ error: "Erreur lors de l'upload vers Supabase Storage" });
    }

    // Générer l'URL publique
    const { data: urlData } = await supabase
      .storage
      .from('photos')
      .getPublicUrl(fileName);

    const photoUrl = urlData.publicUrl;

    // Enregistrer dans la base de données
    const { data: photoData, error: photoError } = await supabase
      .from('photos') // Nom de la table
      .insert([{ url: photoUrl }]);

    if (photoError) {
      console.error("Erreur lors de l'insertion en BDD :", photoError);
      return res.status(500).json({ error: "Erreur lors de l'insertion dans la base de données" });
    }

    res.status(200).json({ message: 'Photo uploadée avec succès !', url: photoUrl });
  } catch (error) {
    console.error("Erreur lors de l'upload :", error);
    res.status(500).json({ error: "Erreur lors de l'upload de la photo." });
  }
});

// Route pour récupérer toutes les photos
app.get('/photos', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('photos') // Table "photos"
      .select('*');

    if (error) {
      console.error("Erreur lors de la récupération des photos :", error);
      return res.status(500).json({ error: "Erreur lors de la récupération des photos." });
    }

    res.status(200).json(data);
  } catch (error) {
    console.error("Erreur lors de la récupération des photos :", error);
    res.status(500).json({ error: "Erreur interne du serveur." });
  }
});

// Démarrer le serveur
app.listen(port, () => {
  console.log(`Serveur démarré sur http://localhost:${port}`);
});