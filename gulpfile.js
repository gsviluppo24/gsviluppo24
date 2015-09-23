/**
 * Opzioni disponibili:
 *
 * --env: string - Definisce l'ambiente di deploy - Default: staging - Valori accettati: staging | prod
 * --branch: string - Definisce il branch di git - Default: develop - Valori accettati: master | develop
 * --debug: boolean - Se settato, la console stamperà degli elementi di controllo -  Default: false
 * --nodry: boolean - Se settato, effettua il deploy, altrimenti solo prova - Default: false
 * 
 * @author Cyril Dally
 * @data: 2015-09-23
 */

var gulp = require('gulp');
var os = require('os');
var gulpif = require('gulp-if');
var uglify = require('gulp-uglify');
var concat = require('gulp-concat');
var minify = require('gulp-minify-css');
var minimist = require('minimist');
var del = require('del');
var fs = require('fs');
var rsync = require('gulp-rsync');
var git = require('gulp-git');
var rename = require('gulp-rename');
var sass = require('gulp-sass');

// Sets the current env and sets the main variables
gulp.task( 'config', function() {

  var hostname = os.hostname();
  if( hostname != 'cdf-pc' ) {
    throw "NON SEI SULLA MACCHINA PONTE!\nhostname = " + hostname;
  }
  
  // Recupera le opzioni
  var options = minimist( process.argv.slice( 2 ) );

  // Se non specificato l'env viene settato su staging
  env = undefined == options.env ? 'staging' : options.env;

  // Se non specificato il branch viene settato su develop
  branch = undefined == options.branch ? 'develop' : options.branch;

  if( env == 'prod' && branch != 'master' ) {
    throw "NON PUOI DEPLOYARE IN PRODUZIONE DA QUESTO BRANCH!\nenv = " + env + "\nbranch = " + branch;
  }

  // Se non specificato il debug viene settato su false
  debug = undefined == options.debug ? false : true;

  // Se non specificato il nodry viene settato su false
  nodry = undefined == options.nodry ? false : true;

  // Di default il disco di destinazione è settato su quello di dev
  // Non è un'opzione modificabile
  path = '/home/cdf/gitProjects/deploy/dev/';
  
  // Se deployiamo in prod, sovvrascriviamo queste variabili
  if( env == "prod" ) {
    branch = 'master';
    path = '/home/cdf/gitProjects/deploy/prod/';
  }

  if( debug ) {
    console.log( "Task config: hostname = " + hostname );
    console.log( "Task config: env = " + env );
    console.log( "Task config: branch = " + branch );
    console.log( "Task config: path = " + path );
    console.log( "Task config: nodry = " + nodry );
  }
});

// Pulls the git down
// Depends on config
gulp.task('git', ['config'], function() {

  if( debug ) {
    console.log( "Task git: branch = " + branch );
  }

  // checkout: verificare sintassi
  git.checkout(branch, {}, function (err) {
    if (err) throw err;
  });

  git.pull('origin', branch, {}, function (err) {
    if (err) throw err;
  });
});

// Clean the css and js dist folder
// Depends on check
gulp.task( 'clean', ['check'], function () {
  return del([ 'source/css/*', 'public/css/*', 'public/js/*' ]);
});

// Compile the css from sass
// Depends on clean
gulp.task( 'sass', ['clean'], function() {

  if( debug ) {
    console.log( "Task sass: env = " + env );
  }

  'use strict';

  return gulp.src('source/sass/**/*.scss')
    .pipe(sass().on('error', sass.logError))
    .pipe(gulp.dest('source/css'));
});

// Minify all css and copy them to dist folder
// Depends on sass
gulp.task( 'cssmin', ['sass'], function() {

  if( debug ) {
    console.log( "Task cssmin: env = " + env );
  }

  // Aggiungere prefix
  // Only minify and rename in prod env
  return gulp.src( 'source/css/*.css' )
    .pipe(minify())
    .pipe(rename(function (path) {
      path.dirname += "";
      path.basename += ".min";
      path.extname = ".css"
    }))
    .pipe(gulp.dest('public/css/'));
});

// Uglify all js and copy them to dist folder
// Depends on clean
gulp.task( 'jsmin', ['clean'], function() {

  if( debug ) {
    console.log( "Task jsmin: env = " + env );
  }

  // Aggiungere prefix
  // Only concat and uglify in prod env
  return gulp.src( 'source/js/*.js' )
    .pipe(concat( "js.min.js" ))
    .pipe(uglify())
    .pipe(gulp.dest('public/js/'));
});

gulp.task('sync', ['compile'], function() {

  if( debug ) {
    console.log( "Task sync: creato file .env." + env );
  }

  // Copia i settings dentro .env per il deploy in base all'env
  fs.createReadStream('.env.' + env).pipe( fs.createWriteStream('.env') );

  var file = fs.readFileSync('rsync-excludelist', "utf8");
  var arr = file.split("\n");

  if( debug ) {
    console.log( "Task sync: arr = " + arr );
  }

  if( nodry ) {
    // Cancella tutto il contenuto della cartella public/
    return del([ path + "public/" ]);

    gulp.src( process.cwd() )
      .pipe( rsync( {
        recursive: true,
        destination: path,
        progress: true,
        incremental: true,
        exclude: arr
      } )
    );
  }

});

// Defines the tasks
gulp.task( 'check', [ 'config', 'git' ] );
gulp.task( 'compile', [ 'check', 'clean', 'sass', 'cssmin', 'jsmin' ] );
gulp.task( 'deploy', [ 'compile', 'sync' ] );

// TODO
// bower-installer: quando ?

