// CONTROLLI DA EFFETTUARE:
// Verifica dell'hostname della macchina
// Se deploiamo in dev può tirare giù da git da qualsiasi branch, invece per prod deve tirare giù unicamente da master
// Prima di iniziare i task tirerà giù il git automaticamente
// In base al branch varia anche il disco di destinazione che è deciso staticamente
// Aggiungere anche l'opzione --dryrun per la conferma del deploy, settato di default a true. Impostando il valore su false deploiera effettivamente i file verso il disco di destinazione


var gulp = require('gulp');
var os   = require('os');
var gulpif = require('gulp-if');
var uglify = require('gulp-uglify');
var minifyCss = require('gulp-minify-css');
var minimist = require('minimist');
var del = require('del');
var fs = require('fs');
var rsync = require('gulp-rsync');
var git = require('gulp-git');
var rename = require('gulp-rename');
var sass = require('gulp-sass');


// VARIABILI DA SETTARE:
// hostname: nome della macchina ponte - Se non corrisponde lo script si ferma
// env: ambiente verso il quale si deploia ( deciderà staticamente l'url del disco di destinazione, nonché i branch dai quali è permesso tirare giù il git ). In poche parole se deploiamo in prod dovrà essere necessariamente tirato giù da git. Se deploiamo in dev potrà essere qualsiasi branch ( se non specifica, di default sarà develop )


var knownOptions = {
  string: 'env',
  default: { env: process.env.NODE_ENV || 'develop' }
};

// Crea un array unico
// TODO: capire come funziona di preciso
var options = minimist( process.argv.slice( 2 ), knownOptions );






// Sets the current env and sets the main variables
gulp.task( 'config', function() {

  var hostname = os.hostname();
  // if( hostname != 'TRLIVEBUILDER' ) {
  //   console.log( "NON SEI SULLA MACCHINA PONTE!\nhostname = " + hostname);
  //   return false;
  // }

  // Se non specificato l'env viene settato su develop
  // -> staging
  env = undefined == options.env ? 'staging' : options.env;

  // Se non specificato il branch viene settato su develop
  branch = undefined == options.branch ? 'develop' : options.branch;

  if( env == 'production' && branch != 'master' ) {
    console.log( "NON PUOI DEPLOIARE IN PRODUZIONE DA QUESTO BRANCH!\nenv = " + env + "\nbranch = " + branch);
    return false;
  }

  // Se non specificato il dryrun viene settato su false
  dryrun = undefined == options.dryrun ? false : options.dryrun;

  // Di default il disco di destinazione è settato su quello di dev
  // Non è un'opzione modificabile
  url = 'disco/di/sviluppo/htdocs/';
  
  if( env == "production" ) {

    branch = 'master';
    url = 'disco/di/produzione/htdocs/';

    // TODO: Riccardo spiegami questo
    // fs.createReadStream('.env.prod').pipe( fs.createWriteStream('.env') );
  }

  console.log( "hostname = " + hostname );
  console.log( "env = " + env );
  console.log( "branch = " + branch );
  console.log( "url = " + url );
  console.log( "dryrun = " + dryrun );
});


// Pulls the git down
// Depends on config
gulp.task('git-pull', ['config'], function() {

  console.log( "branch = " + branch );

  // checkout!

  git.pull('origin', branch, {}, function (err) {
    if (err) throw err;
  });
});




// Clean the css dist folder
// Depends on config
gulp.task( 'clean', ['config'], function () {
  return del([ 'css/*']);
});


// Minify all css and copy them to dist folder
// Depends on clean
gulp.task( 'cssmin', ['clean'], function() {

  return gulp.src( 'source/css/*.css' )
    .pipe(gulpif( options.env == "production", minifyCss() )) // only minify in production
    .pipe(gulp.dest('css'));
});







gulp.task('sync', function() {

  var file = fs.readFileSync('rsync-excludelist', "utf8");
  var arr = file.split("\n");

  gulp.src( process.cwd() )
    .pipe( 
      gulpif( dryrun === true, rsync( {
        recursive: true,
        destination: '../rsync-test/suncharts',
        progress: true,
        incremental: true,
        exclude: arr
    } )
  )
    );

});

// Defines the tasks
gulp.task( 'check', [ 'config', 'git-pull' ] );
gulp.task( 'compile', [ 'check', 'clean', 'cssmin' ] );
gulp.task( 'deploy', [ 'deploy', 'sync' ] );