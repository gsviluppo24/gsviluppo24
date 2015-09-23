/**
 * Opzioni disponibili:
 *
 * --env: string - Definisce l'ambiente di deploy - Default: staging
 * --branch: string - Definisce il branch di git - Default: develop
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

  // Se non specificato l'env viene settato su develop
  env = undefined == options.env ? 'staging' : options.env;

  // Se non specificato il branch viene settato su develop
  branch = undefined == options.branch ? 'develop' : options.branch;

  if( env == 'production' && branch != 'master' ) {
    throw "NON PUOI DEPLOYARE IN PRODUZIONE DA QUESTO BRANCH!\nenv = " + env + "\nbranch = " + branch;
  }

  // Se non specificato il debug viene settato su false
  debug = undefined == options.debug ? false : true;

  // Se non specificato il nodry viene settato su false
  nodry = undefined == options.nodry ? false : true;

  // Di default il disco di destinazione è settato su quello di dev
  // Non è un'opzione modificabile
  path = '/home/cdf/gitProjects/deploy/dev/';

  // Copia i settings in .env per il deploy in dev
  fs.createReadStream('.env.staging').pipe( fs.createWriteStream('.env') );
  
  if( env == "production" ) {
    branch = 'master';
    path = '/home/cdf/gitProjects/deploy/prod/';
    fs.createReadStream('.env.prod').pipe( fs.createWriteStream('.env') );
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
  // Only minify and rename in production env
  return gulp.src( 'source/css/*.css' )
    .pipe(gulpif( env == "production", minify() ))
    .pipe(gulpif( env == "production", rename(function (path) {
      path.dirname += "";
      path.basename += ".min";
      path.extname = ".css"
    })))
    .pipe(gulp.dest('public/css/'));
});

// Uglify all js and copy them to dist folder
// Depends on clean
gulp.task( 'jsmin', ['clean'], function() {

  if( debug ) {
    console.log( "Task jsmin: env = " + env );
  }

  // Aggiungere prefix
  // Only concat and uglify in production env
  return gulp.src( 'source/js/*.js' )
    .pipe(gulpif( env == "production", concat( "js.min.js" ) ))
    .pipe(gulpif( env == "production", uglify() ))
    .pipe(gulp.dest('public/js/'));
});

gulp.task('sync', ['compile'], function() {

  var file = fs.readFileSync('rsync-excludelist', "utf8");
  var arr = file.split("\n");

  if( debug ) {
    console.log( "Task sync: arr = " + arr );
  }

  gulp.src( process.cwd() )
    .pipe( gulpif( nodry , rsync( {
        recursive: true,
        destination: path,
        progress: true,
        incremental: true,
        exclude: arr
      } )
    )
  );

});

// Defines the tasks
gulp.task( 'check', [ 'config', 'git' ] );
gulp.task( 'compile', [ 'check', 'clean', 'sass', 'cssmin', 'jsmin' ] );
gulp.task( 'deploy', [ 'compile', 'sync' ] );

// TODO
// bower-installer

