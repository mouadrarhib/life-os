import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'

function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString()
}

const MUSCLE_GROUP_DEFAULTS = [
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Legs',
  'Glutes',
  'Hamstrings',
  'Core',
  'Full Body',
]

const EQUIPMENT_DEFAULTS = [
  'Barbell',
  'Dumbbells',
  'Cable',
  'Machine',
  'Bodyweight',
  'Kettlebell',
  'Smith Machine',
  'Resistance Band',
]

function toOptionRows(items) {
  return items.map((name) => ({ id: name.toLowerCase().replace(/\s+/g, '-'), name }))
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value || '',
  )
}

function getEntryMetrics(sets) {
  const totalSets = sets.length
  const totalReps = sets.reduce((sum, item) => sum + Number(item.reps || 0), 0)
  const numericWeights = sets
    .map((item) => Number(item.weight_kg))
    .filter((weight) => Number.isFinite(weight) && weight > 0)
  const bestWeight = numericWeights.length > 0 ? Math.max(...numericWeights) : null
  return { totalSets, totalReps, bestWeight }
}

function getInitialSetDraft(lastSet, fallbackSetNo) {
  return {
    setNo: String(fallbackSetNo),
    reps: lastSet?.reps ? String(lastSet.reps) : '',
    weightKg: lastSet?.weight_kg ? String(lastSet.weight_kg) : '',
    rpe: lastSet?.rpe ? String(lastSet.rpe) : '',
    warmup: false,
  }
}

export function FitnessPage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [workouts, setWorkouts] = useState([])
  const [exerciseLibrary, setExerciseLibrary] = useState([])
  const [selectedWorkoutId, setSelectedWorkoutId] = useState(null)
  const [workoutEntries, setWorkoutEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const [workoutTitle, setWorkoutTitle] = useState('Gym Session')
  const [workoutDate, setWorkoutDate] = useState(new Date().toISOString().slice(0, 10))
  const [workoutNote, setWorkoutNote] = useState('')

  const [exerciseName, setExerciseName] = useState('')
  const [muscleGroupOptions, setMuscleGroupOptions] = useState(toOptionRows(MUSCLE_GROUP_DEFAULTS))
  const [equipmentOptions, setEquipmentOptions] = useState(toOptionRows(EQUIPMENT_DEFAULTS))
  const [muscleGroupId, setMuscleGroupId] = useState('')
  const [equipmentId, setEquipmentId] = useState('')

  const [exerciseToAdd, setExerciseToAdd] = useState('')
  const [librarySearch, setLibrarySearch] = useState('')
  const [workoutSearch, setWorkoutSearch] = useState('')
  const [setDraftByEntry, setSetDraftByEntry] = useState({})
  const [activeComposer, setActiveComposer] = useState('library')

  const libraryFormRef = useRef(null)
  const addSessionFormRef = useRef(null)

  const selectedWorkout = useMemo(
    () => workouts.find((item) => item.id === selectedWorkoutId) || null,
    [selectedWorkoutId, workouts],
  )

  const filteredWorkoutEntries = useMemo(() => {
    const keyword = workoutSearch.trim().toLowerCase()
    if (!keyword) return workoutEntries
    return workoutEntries.filter((entry) =>
      (entry.exercise?.name || '').toLowerCase().includes(keyword),
    )
  }, [workoutEntries, workoutSearch])

  const filteredExerciseLibrary = useMemo(() => {
    const keyword = librarySearch.trim().toLowerCase()
    if (!keyword) return exerciseLibrary
    return exerciseLibrary.filter((item) => item.name.toLowerCase().includes(keyword))
  }, [exerciseLibrary, librarySearch])

  useEffect(() => {
    if (!exerciseToAdd) return
    const stillVisible = filteredExerciseLibrary.some((item) => item.id === exerciseToAdd)
    if (!stillVisible) {
      setExerciseToAdd('')
    }
  }, [exerciseToAdd, filteredExerciseLibrary])

  const sessionMetrics = useMemo(() => {
    const totals = workoutEntries.reduce(
      (acc, entry) => {
        const metrics = getEntryMetrics(entry.sets || [])
        acc.exercises += 1
        acc.sets += metrics.totalSets
        acc.reps += metrics.totalReps
        return acc
      },
      { exercises: 0, sets: 0, reps: 0 },
    )
    return totals
  }, [workoutEntries])

  const loadWorkouts = async () => {
    const { data, error } = await supabase
      .from('workouts')
      .select('id, title, note, workout_date, created_at')
      .eq('user_id', user.id)
      .order('workout_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      setErrorMessage(error.message)
      return []
    }

    setWorkouts(data || [])
    return data || []
  }

  const loadExerciseLibrary = async () => {
    const { data, error } = await supabase
      .from('exercises')
      .select('id, name, muscle_group, equipment')
      .eq('user_id', user.id)
      .order('name', { ascending: true })

    if (error) {
      setErrorMessage(error.message)
      return []
    }

    setExerciseLibrary(data || [])
    return data || []
  }

  const loadExerciseOptions = async () => {
    const [muscleGroupsResult, equipmentsResult] = await Promise.all([
      supabase.from('fitness_muscle_groups').select('id, name').order('name', { ascending: true }),
      supabase.from('fitness_equipments').select('id, name').order('name', { ascending: true }),
    ])

    if (!muscleGroupsResult.error && (muscleGroupsResult.data || []).length > 0) {
      setMuscleGroupOptions(muscleGroupsResult.data)
    } else {
      setMuscleGroupOptions(toOptionRows(MUSCLE_GROUP_DEFAULTS))
    }

    if (!equipmentsResult.error && (equipmentsResult.data || []).length > 0) {
      setEquipmentOptions(equipmentsResult.data)
    } else {
      setEquipmentOptions(toOptionRows(EQUIPMENT_DEFAULTS))
    }
  }

  const loadWorkoutDetails = async (workoutId) => {
    if (!workoutId) {
      setWorkoutEntries([])
      return
    }

    const { data, error } = await supabase
      .from('workout_exercises')
      .select('id, order_index, note, exercise:exercises(id, name, muscle_group, equipment), sets(id, set_no, reps, weight_kg, rpe, is_warmup)')
      .eq('workout_id', workoutId)
      .order('order_index', { ascending: true })

    if (error) {
      setErrorMessage(error.message)
      return
    }

    const normalized = (data || []).map((entry) => {
      const sets = [...(entry.sets || [])].sort((a, b) => a.set_no - b.set_no)
      const fallbackSetNo = (sets[sets.length - 1]?.set_no || 0) + 1
      return {
        ...entry,
        sets,
        defaultDraft: getInitialSetDraft(sets[sets.length - 1], fallbackSetNo),
      }
    })

    setWorkoutEntries(normalized)
  }

  useEffect(() => {
    let mounted = true

    const init = async () => {
      setLoading(true)
      const nextWorkouts = await loadWorkouts()
      await loadExerciseLibrary()
      await loadExerciseOptions()

      if (!mounted) return

      const firstWorkoutId = nextWorkouts[0]?.id || null
      setSelectedWorkoutId(firstWorkoutId)
      await loadWorkoutDetails(firstWorkoutId)
      setLoading(false)
    }

    init()

    return () => {
      mounted = false
    }
  }, [user.id])

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth', { replace: true })
  }

  const handleCreateWorkout = async (event) => {
    event.preventDefault()
    const payload = {
      user_id: user.id,
      workout_date: workoutDate,
      title: workoutTitle.trim() || 'Gym Session',
      note: workoutNote.trim() || null,
    }

    const { data, error } = await supabase.from('workouts').insert(payload).select('id').single()
    if (error) {
      setErrorMessage(error.message)
      return
    }

    const workoutId = data?.id || null
    setWorkoutNote('')
    await loadWorkouts()
    setSelectedWorkoutId(workoutId)
    await loadWorkoutDetails(workoutId)
  }

  const handleDeleteWorkout = async (workoutId) => {
    const { error } = await supabase.from('workouts').delete().eq('id', workoutId)
    if (error) {
      setErrorMessage(error.message)
      return
    }

    const nextWorkouts = await loadWorkouts()
    const nextId = nextWorkouts[0]?.id || null
    setSelectedWorkoutId(nextId)
    await loadWorkoutDetails(nextId)
  }

  const handleCreateExercise = async (event) => {
    event.preventDefault()
    if (!exerciseName.trim()) return

    const selectedMuscleGroup = muscleGroupOptions.find((item) => item.id === muscleGroupId)
    const selectedEquipment = equipmentOptions.find((item) => item.id === equipmentId)

    const payload = {
      user_id: user.id,
      name: exerciseName.trim(),
      muscle_group: selectedMuscleGroup?.name || null,
      equipment: selectedEquipment?.name || null,
    }

    if (isUuid(selectedMuscleGroup?.id)) {
      payload.muscle_group_id = selectedMuscleGroup.id
    }

    if (isUuid(selectedEquipment?.id)) {
      payload.equipment_id = selectedEquipment.id
    }

    const { error } = await supabase.from('exercises').insert(payload)
    if (error) {
      setErrorMessage(error.message)
      return
    }

    setExerciseName('')
    setMuscleGroupId('')
    setEquipmentId('')
    await loadExerciseLibrary()
  }

  const handleAttachExercise = async () => {
    if (!selectedWorkoutId || !exerciseToAdd) return

    const payload = {
      workout_id: selectedWorkoutId,
      exercise_id: exerciseToAdd,
      order_index: workoutEntries.length + 1,
    }

    const { error } = await supabase.from('workout_exercises').insert(payload)
    if (error) {
      setErrorMessage(error.message)
      return
    }

    setExerciseToAdd('')
    await loadWorkoutDetails(selectedWorkoutId)
  }

  const handleRemoveWorkoutExercise = async (workoutExerciseId) => {
    const { error } = await supabase.from('workout_exercises').delete().eq('id', workoutExerciseId)
    if (error) {
      setErrorMessage(error.message)
      return
    }
    await loadWorkoutDetails(selectedWorkoutId)
  }

  const handleSetDraftChange = (entry, field, value) => {
    setSetDraftByEntry((prev) => ({
      ...prev,
      [entry.id]: {
        ...(prev[entry.id] || entry.defaultDraft),
        [field]: value,
      },
    }))
  }

  const handleAddSet = async (entry) => {
    const draft = setDraftByEntry[entry.id] || entry.defaultDraft
    const payload = {
      workout_exercise_id: entry.id,
      set_no: Number(draft.setNo) || (entry.sets[entry.sets.length - 1]?.set_no || 0) + 1,
      reps: Number(draft.reps) || 0,
      weight_kg: draft.weightKg ? Number(draft.weightKg) : null,
      rpe: draft.rpe || null,
      is_warmup: Boolean(draft.warmup),
    }

    const { error } = await supabase.from('sets').insert(payload)
    if (error) {
      setErrorMessage(error.message)
      return
    }

    await loadWorkoutDetails(selectedWorkoutId)
    setSetDraftByEntry((prev) => ({ ...prev, [entry.id]: undefined }))
  }

  const handleDeleteSet = async (setId) => {
    const { error } = await supabase.from('sets').delete().eq('id', setId)
    if (error) {
      setErrorMessage(error.message)
      return
    }
    await loadWorkoutDetails(selectedWorkoutId)
  }

  const scrollToComposer = (target) => {
    const ref = target === 'library' ? libraryFormRef : addSessionFormRef
    setActiveComposer(target)
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (loading) {
    return <div className="screen-center">Loading fitness module...</div>
  }

  return (
    <main className="dashboard-layout fitness-layout">
      <section className="dashboard-card">
        <div>
          <p className="eyebrow">Fitness</p>
          <h1>Gym Tracker</h1>
          <p className="muted">Log workouts, sets, reps, and weights in a focused session view.</p>
        </div>

        <div className="header-actions">
          <Link to="/dashboard" className="ghost-link">
            Back to dashboard
          </Link>
          <button type="button" className="primary-btn" onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
      </section>

      {errorMessage ? <p className="message error">{errorMessage}</p> : null}

      <section className="fitness-grid">
        <aside className="panel fitness-sidebar">
          <h2 className="fitness-title">Workout Sessions</h2>

          <form onSubmit={handleCreateWorkout} className="form-grid compact-form">
            <label>
              Date
              <input type="date" value={workoutDate} onChange={(event) => setWorkoutDate(event.target.value)} />
            </label>
            <label>
              Session title
              <input
                value={workoutTitle}
                onChange={(event) => setWorkoutTitle(event.target.value)}
                placeholder="Push Day"
              />
            </label>
            <label>
              Notes
              <input
                value={workoutNote}
                onChange={(event) => setWorkoutNote(event.target.value)}
                placeholder="PR attempt on incline"
              />
            </label>
            <button className="primary-btn" type="submit">
              Start workout
            </button>
          </form>

          <div className="fitness-list-scroll">
            {workouts.map((workout) => (
              <article key={workout.id} className={`fitness-list-item ${selectedWorkoutId === workout.id ? 'active' : ''}`}>
                <button
                  type="button"
                  className="session-open"
                  onClick={async () => {
                    setSelectedWorkoutId(workout.id)
                    await loadWorkoutDetails(workout.id)
                  }}
                >
                  <span>{workout.title || 'Workout Session'}</span>
                  <small>{formatDate(workout.workout_date)}</small>
                </button>
                <button
                  type="button"
                  className="danger-btn"
                  onClick={() => handleDeleteWorkout(workout.id)}
                >
                  Delete
                </button>
              </article>
            ))}
          </div>
        </aside>

        <section className="panel fitness-main">
          <div className="fitness-stats-row">
            <article className="stat-card">
              <p className="muted small-text">Exercises</p>
              <p className="stat-value">{sessionMetrics.exercises}</p>
            </article>
            <article className="stat-card">
              <p className="muted small-text">Sets</p>
              <p className="stat-value">{sessionMetrics.sets}</p>
            </article>
            <article className="stat-card">
              <p className="muted small-text">Total reps</p>
              <p className="stat-value fit-date">{sessionMetrics.reps}</p>
            </article>
          </div>

          <div className="composer-shell">
            <div className="segment-switch" role="tablist" aria-label="Exercise actions">
              <button
                type="button"
                role="tab"
                aria-selected={activeComposer === 'library'}
                className={activeComposer === 'library' ? 'segment-btn active' : 'segment-btn'}
                onClick={() => scrollToComposer('library')}
              >
                Exercise Library
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeComposer === 'session'}
                className={activeComposer === 'session' ? 'segment-btn active' : 'segment-btn'}
                onClick={() => scrollToComposer('session')}
              >
                Add To Session
              </button>
            </div>

            <div className="fitness-actions-grid">
              <form
                ref={libraryFormRef}
                onSubmit={handleCreateExercise}
                className="form-grid compact-form feature-form library-form"
              >
              <h2 className="fitness-title">Exercise Library</h2>
              <p className="muted small-text">Create your reusable exercise list once, then add in one tap.</p>
              <label>
                Exercise name
                <input
                  value={exerciseName}
                  onChange={(event) => setExerciseName(event.target.value)}
                  placeholder="Barbell Squat"
                  required
                />
              </label>
              <div className="task-form-row library-fields-row">
                <label>
                  Muscle group
                  <select
                    value={muscleGroupId}
                    onChange={(event) => setMuscleGroupId(event.target.value)}
                  >
                    <option value="">Select muscle group</option>
                    {muscleGroupOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Equipment
                  <select value={equipmentId} onChange={(event) => setEquipmentId(event.target.value)}>
                    <option value="">Select equipment</option>
                    {equipmentOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button className="primary-btn" type="submit">
                Save exercise
              </button>
            </form>

              <div
                ref={addSessionFormRef}
                className="form-grid compact-form feature-form add-session-form"
              >
              <h2 className="fitness-title">Add Exercise To Session</h2>
              <p className="muted small-text">Pick from your library and attach it to the active workout.</p>
              <label>
                Search library
                <input
                  value={librarySearch}
                  onChange={(event) => setLibrarySearch(event.target.value)}
                  placeholder="Find exercise"
                />
              </label>
              <p className="muted small-text">
                Matches {filteredExerciseLibrary.length} of {exerciseLibrary.length}
              </p>
              <div className="search-results-row">
                {filteredExerciseLibrary.slice(0, 5).map((exercise) => (
                  <button
                    key={exercise.id}
                    type="button"
                    className={`result-chip ${exerciseToAdd === exercise.id ? 'active' : ''}`}
                    onClick={() => setExerciseToAdd(exercise.id)}
                  >
                    {exercise.name}
                  </button>
                ))}
              </div>
              <label>
                Select exercise
                <select
                  value={exerciseToAdd}
                  onChange={(event) => setExerciseToAdd(event.target.value)}
                  disabled={filteredExerciseLibrary.length === 0}
                >
                  <option value="">Choose exercise</option>
                  {filteredExerciseLibrary.map((exercise) => (
                    <option key={exercise.id} value={exercise.id}>
                      {exercise.name}
                    </option>
                  ))}
                </select>
              </label>
              {filteredExerciseLibrary.length === 0 ? (
                <p className="message error">No exercises match this search.</p>
              ) : null}
              <button
                className="primary-btn"
                type="button"
                onClick={handleAttachExercise}
                disabled={!selectedWorkoutId || !exerciseToAdd}
              >
                Add to workout
              </button>
            </div>
            </div>
          </div>

          <div className="filter-footer">
            <p className="muted small-text">
              Active session: {selectedWorkout?.title || 'None selected'} ({formatDate(selectedWorkout?.workout_date)})
            </p>
            <input
              className="workout-search"
              value={workoutSearch}
              onChange={(event) => setWorkoutSearch(event.target.value)}
              placeholder="Filter session exercises"
            />
          </div>

          <div className="fitness-list-scroll workout-scroll">
            {filteredWorkoutEntries.map((entry) => {
              const draft = setDraftByEntry[entry.id] || entry.defaultDraft
              const metrics = getEntryMetrics(entry.sets || [])

              return (
                <article key={entry.id} className="task-item exercise-card">
                  <div className="exercise-head">
                    <div>
                      <p className="task-title">{entry.exercise?.name || 'Exercise'}</p>
                      <p className="muted small-text">
                        {entry.exercise?.muscle_group || 'General'}
                        {entry.exercise?.equipment ? ` • ${entry.exercise.equipment}` : ''}
                      </p>
                    </div>
                    <div className="task-actions">
                      <span className="metric-chip">{metrics.totalSets} sets</span>
                      <span className="metric-chip">{metrics.totalReps} reps</span>
                      <span className="metric-chip">
                        Top weight {metrics.bestWeight ? `${metrics.bestWeight} kg` : '-'}
                      </span>
                      <button
                        type="button"
                        className="danger-btn"
                        onClick={() => handleRemoveWorkoutExercise(entry.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className="set-table">
                    <div className="set-table-head">
                      <span>Set</span>
                      <span>Reps</span>
                      <span>Weight</span>
                      <span>RPE (1-10)</span>
                      <span>Type</span>
                      <span>Action</span>
                    </div>

                    {(entry.sets || []).map((setItem) => (
                      <div key={setItem.id} className="set-table-row">
                        <span className="set-cell" data-label="Set">
                          {setItem.set_no}
                        </span>
                        <span className="set-cell" data-label="Reps">
                          {setItem.reps}
                        </span>
                        <span className="set-cell" data-label="Weight">
                          {setItem.weight_kg || '-'}
                        </span>
                        <span className="set-cell" data-label="RPE">
                          {setItem.rpe || '-'}
                        </span>
                        <span className="set-cell" data-label="Type">
                          {setItem.is_warmup ? 'Warmup' : 'Work'}
                        </span>
                        <button
                          type="button"
                          className="danger-btn"
                          onClick={() => handleDeleteSet(setItem.id)}
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="set-entry-form">
                    <input
                      type="number"
                      min="1"
                      value={draft.setNo || ''}
                      onChange={(event) => handleSetDraftChange(entry, 'setNo', event.target.value)}
                      placeholder="Set"
                    />
                    <input
                      type="number"
                      min="0"
                      value={draft.reps || ''}
                      onChange={(event) => handleSetDraftChange(entry, 'reps', event.target.value)}
                      placeholder="Reps"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={draft.weightKg || ''}
                      onChange={(event) => handleSetDraftChange(entry, 'weightKg', event.target.value)}
                      placeholder="Weight"
                    />
                    <input
                      type="text"
                      value={draft.rpe || ''}
                      onChange={(event) => handleSetDraftChange(entry, 'rpe', event.target.value)}
                      placeholder="RPE 8"
                    />
                    <select
                      value={draft.warmup ? 'warmup' : 'work'}
                      onChange={(event) =>
                        handleSetDraftChange(entry, 'warmup', event.target.value === 'warmup')
                      }
                    >
                      <option value="work">Work set</option>
                      <option value="warmup">Warmup set</option>
                    </select>
                    <button type="button" className="primary-btn" onClick={() => handleAddSet(entry)}>
                      Log set
                    </button>
                  </div>
                  <p className="muted small-text">
                    RPE = effort level from 1 to 10. Example: RPE 8 means you could still do ~2 more reps.
                  </p>
                </article>
              )
            })}

            {!selectedWorkoutId ? <p className="muted">Create a workout to start logging sets.</p> : null}
            {selectedWorkoutId && filteredWorkoutEntries.length === 0 ? (
              <p className="muted">No exercises yet in this session.</p>
            ) : null}
          </div>
        </section>
      </section>

      <div className="mobile-quick-bar" aria-label="Quick exercise actions">
        <button
          type="button"
          className={activeComposer === 'library' ? 'quick-bar-btn active' : 'quick-bar-btn'}
          onClick={() => scrollToComposer('library')}
        >
          Library
        </button>
        <button
          type="button"
          className={activeComposer === 'session' ? 'quick-bar-btn active' : 'quick-bar-btn'}
          onClick={() => scrollToComposer('session')}
        >
          Add to Session
        </button>
      </div>
    </main>
  )
}
