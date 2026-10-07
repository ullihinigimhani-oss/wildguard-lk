const db = () => require('../config/database');

exports.findAnimalByCode = (animalCode) =>
  db().animal.findUnique({ where: { animalCode } });

exports.createAnimal = (data) =>
  db().animal.create({ data });

exports.createAnimalLocation = (data) =>
  db().animalLocation.create({ data });

exports.findLatestLocationByAnimalId = (animalId) =>
  db().animalLocation.findFirst({
    where: { animalId },
    orderBy: { recordedAt: 'desc' }
  });

exports.updateAnimalLocation = (id, data) =>
  db().animalLocation.update({
    where: { id },
    data
  });

exports.getAllAnimals = () =>
  db().animal.findMany({
    include: {
      locations: {
        orderBy: { recordedAt: 'desc' },
        take: 1
      },
      collar: true
    }
  });

exports.getAnimalsWithLatestLocations = () =>
  db().animal.findMany({
    include: {
      locations: {
        orderBy: { recordedAt: 'desc' },
        take: 1
      }
    }
  });

exports.updateAnimal = (id, data) =>
  db().animal.update({
    where: { id },
    data
  });
