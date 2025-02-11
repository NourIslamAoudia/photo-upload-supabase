require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const fs = require('fs'); // Importer FileSystem

// Configuration de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Configuration de Multer (Stockage temporaire dans /tmp/)
const upload = multer({ dest: '/tmp/' });

// Initialisation d'Express
const app = express();
const port = 3000;
app.use(express.json());
app.use(cors());

// Route pour uploader une photo
app.post('/upload', upload.single('photo'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Aucun fichier uploadé.' });
    }

    // Lire le fichier depuis /tmp/
    const filePath = file.path;
    const fileBuffer = fs.readFileSync(filePath);

    // Générer un nom de fichier unique
    const fileName = `public/${Date.now()}-${file.originalname}`;

    // Upload du fichier vers Supabase Storage
    const { data, error } = await supabase.storage
      .from('photos')
      .upload(fileName, fileBuffer, {
        contentType: file.mimetype,
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error("Erreur lors de l'upload Supabase :", error);
      return res.status(500).json({ error: "Erreur lors de l'upload vers Supabase Storage" });
    }

    // Générer l'URL publique
    const { data: publicUrlData } = supabase.storage.from('photos').getPublicUrl(fileName);
    const publicUrl = publicUrlData.publicUrl;

    // Enregistrer dans la base de données
    const { data: photoData, error: photoError } = await supabase
      .from('photos') // Nom de la table
      .insert([{ url: publicUrl }]);

    if (photoError) {
      console.error("Erreur lors de l'insertion en BDD :", photoError);
      return res.status(500).json({ error: "Erreur lors de l'insertion dans la base de données" });
    }

    // Supprimer le fichier temporaire après l'upload
    fs.unlinkSync(filePath);

    res.status(200).json({ message: 'Photo uploadée avec succès !', url: publicUrl });
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
