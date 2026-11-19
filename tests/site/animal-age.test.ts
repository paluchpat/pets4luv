import assert from 'node:assert/strict'
import { test } from 'node:test'
import { animalAgeGroupWhere, orderAnimalsByAge } from '../../src/lib/animal-age'

const now = new Date('2026-11-19T16:00:00.000Z')

test('age sorting places undated animals in their range in both directions', () => {
  const alphabetically = [
    { name: 'Aster', ageGroup: 'adult', estimatedBirthDate: '2017-10-08' },
    { name: 'Bramble', ageGroup: 'young', estimatedBirthDate: '2025-07-08T00:00:00.000Z' },
    { name: 'Clover', ageGroup: 'young' },
    { name: 'Daisy', ageGroup: 'baby', estimatedBirthDate: '2026-02-09T00:00:00.000Z' },
    { name: 'Elm', ageGroup: 'baby', estimatedBirthDate: null },
    { name: 'Flax', ageGroup: 'baby' },
    { name: 'Hazel', ageGroup: 'adult', estimatedBirthDate: '2021-06-14' },
    { name: 'Iris', ageGroup: 'adult', estimatedBirthDate: '2024-10-08' },
    { name: 'Juniper', ageGroup: 'senior', estimatedBirthDate: '2016-04-11T00:00:00.000Z' },
    { name: 'Lark', ageGroup: 'baby', estimatedBirthDate: '2026-07-23' },
    { name: 'Unknown', estimatedBirthDate: 'invalid' },
  ]
  assert.deepEqual(orderAnimalsByAge(alphabetically, false, now).map(animal => animal.name), [
    'Lark', 'Daisy', 'Elm', 'Flax', 'Bramble', 'Iris', 'Clover', 'Hazel', 'Aster', 'Juniper', 'Unknown',
  ])
  assert.deepEqual(orderAnimalsByAge(alphabetically, true, now).map(animal => animal.name), [
    'Juniper', 'Aster', 'Hazel', 'Iris', 'Bramble', 'Clover', 'Daisy', 'Lark', 'Elm', 'Flax', 'Unknown',
  ])
})

test('selected age ranges use birth date bounds and only use the saved age group for undated animals', () => {
  assert.deepEqual(animalAgeGroupWhere('adult', now), { or: [
    { estimatedBirthDate: {
      less_than_equal: '2023-11-19T23:59:59.999Z', greater_than: '2018-11-18T23:59:59.999Z',
    } },
    { estimatedBirthDate: { exists: false }, ageGroup: { equals: 'adult' } },
  ] })
  assert.equal(animalAgeGroupWhere('any', now), undefined)
})
